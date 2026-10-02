import { NTS } from '@fly/data';
import {
  abs,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  clamp,
  exp,
  float,
  fract,
  int,
  ivec2,
  length,
  max,
  min,
  mix,
  modelViewMatrix,
  normalize,
  oneMinus,
  positionGeometry,
  screenSize,
  select,
  smoothstep,
  textureLoad,
  uniform,
  uniformArray,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DataTexture,
  FloatType,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  RedFormat,
} from 'three/webgpu';
import { NEVER } from '@/sim/feed';
import type { DebugMode } from '@/state/params';
import { hexToLinear, NT_COLORS } from '@/ui/palette';
import { SEG_STRIDE } from '../segments';

/** Ribbon width = node diameter × gain, clamped (µm): stylised, giant fibres must not swamp the view. */
const WIDTH_GAIN = 1.5;
const MIN_WIDTH = 0.6;
const MAX_WIDTH = 5;
/** Ribbons thinner than this (physical px) are drawn at it but dimmed by the ratio — no aliasing. */
const MIN_PX = 1.5;
/** Additive: dense neuropils (lobula, VNC end-on) stack hundreds of ribbons, keep this low. */
const GAIN = 0.22;
/** How much the ribbon centre whitens (hot core). */
const CORE = 0.12;
/** µm in front of / behind the orbit centre over which ribbons dim to `FAR_DIM` (as the dust). */
const DEPTH_RANGE = 350;
const FAR_DIM = 0.35;

/** Resting brightness relative to the wave (silent neurons stay visible as context). */
const REST = 0.2;
/** Conduction speed of the drawn spike front along a neurite (µm per sim ms). */
const WAVE_UM_PER_MS = 20;
/** Bright tail behind the front / soft lead in front of it (µm). */
const TAIL_UM = 30;
const LEAD_UM = 4;
/** Peak brightness at the front (×, HDR — feeds bloom). */
const PULSE = 3;
/** The whole neuron keeps a fading glow after it fired. */
const AFTERGLOW = 0.4;
const AFTERGLOW_MS = 40;
/** Width of the per-row spike texture. */
const TEX_W = 256;

/** Debug colour modes (`?debug=`): flat colour by attribute, activity off. */
export const COLOR_MODES = ['soma-dist', 'id', 'nt', 'region'] as const satisfies readonly DebugMode[];
export type ColorMode = (typeof COLOR_MODES)[number];
export const isColorMode = (m: DebugMode | undefined): m is ColorMode =>
  (COLOR_MODES as readonly string[]).includes(m ?? '');
/** Colour modes draw opaque, depth-tested ribbons (additive stacks wash hues to white); kept < bloom. */
const DEBUG_LEVEL = 0.8;
/** soma-dist: ramp spans 0..this (µm, clamped), dark tick every `DIST_TICK_UM`. */
const DIST_SPAN_UM = 500;
const DIST_TICK_UM = 50;
/** soma-dist ramp: soma (dark blue) → tips (white). */
const DIST_RAMP = ['#1d2b8f', '#1f9fb8', '#5fd17a', '#ffd23f', '#ffffff'];
/** id / region: golden-ratio hue steps keep consecutive codes far apart; -1 → grey. */
const GOLDEN = 0.618034;
const UNKNOWN = 0.25;

export interface NeuronsLayer {
  mesh: Mesh;
  /** Sim time shown, ms. */
  simTime: { value: number };
  /** Last spike time per graph row (sim ms, NEVER if silent); call `commit` after writing. */
  lastSpike: Float32Array;
  commit(): void;
}

/**
 * Hero neurons: every skeleton segment is one instanced screen-facing quad (WebGPU lines are 1 px).
 * Additive glow over the background layers; colour by transmitter.
 */
export function neuronsLayer(
  seg: Float32Array,
  rows: number,
  worldScale: number,
  mode?: ColorMode,
  /** Fades the glowing ribbons in (intro); colour modes are always fully shown. */
  reveal: Node<'float'> | number = 1,
): NeuronsLayer {
  const geo = new InstancedBufferGeometry();
  // x: 0 at the node, 1 at its parent; y: −1..1 across
  geo.setAttribute(
    'position',
    new BufferAttribute(Float32Array.from([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const buf = new InstancedInterleavedBuffer(seg, SEG_STRIDE);
  geo.setAttribute('segA', new InterleavedBufferAttribute(buf, 4, 0));
  geo.setAttribute('segB', new InterleavedBufferAttribute(buf, 4, 4));
  geo.setAttribute('segC', new InterleavedBufferAttribute(buf, 4, 8));
  geo.instanceCount = seg.length / SEG_STRIDE;

  const segA = attribute('segA', 'vec4');
  const segB = attribute('segB', 'vec4');
  const segC = attribute('segC', 'vec4');

  const mvp = cameraProjectionMatrix.mul(modelViewMatrix);
  const ca = mvp.mul(vec4(segA.xyz, 1));
  const cb = mvp.mul(vec4(segB.xyz, 1));
  const c = mix(ca, cb, positionGeometry.x);

  // screen direction in pixels → perpendicular
  const d = cb.xy.div(cb.w).sub(ca.xy.div(ca.w)).mul(screenSize);
  const dir = select(length(d).greaterThan(1e-4), normalize(d), vec2(1, 0));
  const normal = vec2(dir.y.negate(), dir.x);

  // radius is in source units, `worldScale` µm each; P[1][1] turns µm at depth w into NDC
  const projY = uniform(1).onRenderUpdate(({ camera }) => camera?.projectionMatrix.elements[5] ?? 1);
  const widthUm = clamp(segC.z.mul(2 * WIDTH_GAIN * worldScale), MIN_WIDTH, MAX_WIDTH);
  const px = widthUm.mul(projY).mul(screenSize.y).mul(0.5).div(c.w);
  const drawPx = max(px, MIN_PX);
  const offset = normal.mul(positionGeometry.y).mul(drawPx).div(screenSize).mul(c.w);

  // activity: last spike of this segment's neuron (rows without meta never fire)
  const texH = Math.max(1, Math.ceil(rows / TEX_W));
  const lastSpike = new Float32Array(TEX_W * texH).fill(NEVER);
  const spikeTex = new DataTexture(lastSpike, TEX_W, texH, RedFormat, FloatType);
  spikeTex.needsUpdate = true;
  const simTime = uniform(0);
  const row = int(segC.x);
  const spike = select(
    row.greaterThanEqual(0),
    textureLoad(spikeTex, ivec2(row.mod(TEX_W), row.div(TEX_W))).x,
    float(NEVER),
  );
  const age = varying(simTime.sub(spike));
  const distUm = varying(mix(segA.w, segB.w, positionGeometry.x).mul(worldScale));

  const mat = mode
    ? new MeshBasicNodeMaterial()
    : new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  mat.vertexNode = vec4(c.x.add(offset.x), c.y.add(offset.y), c.z, c.w);

  const palette = uniformArray(
    NTS.map((nt) => new Color(...NT_COLORS[nt].rgb)),
    'color',
  );
  // typings lose the element type of a uniform array
  const ntTint = palette.element(int(segC.y)) as unknown as Node<'vec3'>;
  const tint = varying(mode === 'id' ? codeColor(segC.x) : mode === 'region' ? codeColor(segC.w) : ntTint);
  const fade = varying(min(px.div(MIN_PX), 1));
  // c.w = view depth; the orbit target is the origin
  const behind = c.w.sub(length(cameraPosition)).div(DEPTH_RANGE);
  const depthDim = varying(mix(1, FAR_DIM, smoothstep(-1, 1, behind)));
  const across = abs(varying(positionGeometry.y));
  const glow = oneMinus(across).pow(1.5);
  const core = oneMinus(smoothstep(0, 0.35, across)).mul(CORE);
  // opaque ribbons: shade across the width so they still read as tubes
  const shade = mix(0.45, 1, oneMinus(across)).mul(depthDim).mul(DEBUG_LEVEL);
  if (mode === 'soma-dist') {
    const tick = mix(0.35, 1, smoothstep(0, 0.12, fract(distUm.div(DIST_TICK_UM))));
    mat.colorNode = ramp(distUm.div(DIST_SPAN_UM).min(1)).mul(tick).mul(shade);
  } else if (mode) {
    mat.colorNode = tint.mul(shade);
  } else {
    // distance the front has run past this point (µm); < 0 = not reached yet
    const past = age.mul(WAVE_UM_PER_MS).sub(distUm);
    const pulse = select(past.greaterThanEqual(0), exp(past.negate().div(TAIL_UM)), exp(past.div(LEAD_UM)));
    const after = select(past.greaterThanEqual(0), exp(age.negate().div(AFTERGLOW_MS)), float(0));
    const level = float(REST).add(pulse.mul(PULSE)).add(after.mul(AFTERGLOW));
    mat.colorNode = mix(tint, vec3(1), core.add(pulse.mul(0.5)).min(1)).mul(level);
    mat.opacityNode = glow.mul(fade).mul(depthDim).mul(float(GAIN)).mul(reveal);
  }

  const mesh = new Mesh(geo, mat);
  mesh.name = 'neurons';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return {
    mesh,
    simTime,
    lastSpike,
    commit: () => {
      spikeTex.needsUpdate = true;
    },
  };
}

/** Distinct hue per integer code (id, region); negative = unknown → grey. */
function codeColor(code: Node<'float'>): Node<'vec3'> {
  const h = fract(code.mul(GOLDEN));
  const rgb = abs(
    fract(vec3(h, h.add(2 / 3), h.add(1 / 3)))
      .mul(6)
      .sub(3),
  )
    .sub(1)
    .clamp(0, 1);
  return select(code.greaterThanEqual(0), mix(rgb, vec3(1), 0.15), vec3(UNKNOWN));
}

/** Piecewise-linear `DIST_RAMP` over t ∈ 0..1. */
function ramp(t: Node<'float'>): Node<'vec3'> {
  const stops = DIST_RAMP.map((hex) => vec3(...hexToLinear(hex)));
  const n = stops.length - 1;
  return stops
    .slice(1)
    .reduce((c, stop, i) => mix(c, stop, t.mul(n).sub(i).clamp(0, 1)), stops[0] as Node<'vec3'>);
}
