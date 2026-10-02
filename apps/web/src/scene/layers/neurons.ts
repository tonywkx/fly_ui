import { NTS } from '@fly/data';
import {
  abs,
  attribute,
  cameraPosition,
  cameraProjectionMatrix,
  clamp,
  float,
  int,
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
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
} from 'three/webgpu';
import { NT_COLORS } from '@/ui/palette';
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

/**
 * Hero neurons: every skeleton segment is one instanced screen-facing quad (WebGPU lines are 1 px).
 * Additive glow over the background layers; colour by transmitter.
 */
export function neuronsLayer(seg: Float32Array, worldScale: number): Mesh {
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

  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  mat.vertexNode = vec4(c.x.add(offset.x), c.y.add(offset.y), c.z, c.w);

  const palette = uniformArray(
    NTS.map((nt) => new Color(...NT_COLORS[nt].rgb)),
    'color',
  );
  // typings lose the element type of a uniform array
  const tint = varying(palette.element(int(segC.y)) as unknown as Node<'vec3'>);
  const fade = varying(min(px.div(MIN_PX), 1));
  // c.w = view depth; the orbit target is the origin
  const behind = c.w.sub(length(cameraPosition)).div(DEPTH_RANGE);
  const depthDim = varying(mix(1, FAR_DIM, smoothstep(-1, 1, behind)));
  const across = abs(varying(positionGeometry.y));
  const glow = oneMinus(across).pow(1.5);
  const core = oneMinus(smoothstep(0, 0.35, across)).mul(CORE);
  mat.colorNode = mix(tint, vec3(1), core);
  mat.opacityNode = glow.mul(fade).mul(depthDim).mul(float(GAIN));

  const mesh = new Mesh(geo, mat);
  mesh.name = 'neurons';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}
