import {
  cameraPosition,
  clamp,
  color,
  cos,
  floor,
  fract,
  hash,
  instancedBufferAttribute,
  instanceIndex,
  int,
  ivec2,
  length,
  mix,
  oneMinus,
  positionView,
  sin,
  smoothstep,
  sqrt,
  textureLoad,
  uniform,
  uv,
  vec3,
} from 'three/tsl';
import {
  AdditiveBlending,
  DataTexture,
  FloatType,
  Group,
  InstancedBufferAttribute,
  type Node,
  RedFormat,
  Sprite,
  SpriteNodeMaterial,
} from 'three/webgpu';
import { bezierLut, EASE_IN_OUT, INTRO } from '../intro';

const DUST_COLOR = 0xb4bccc;
/** Sprite diameter in µm (world units after `Engine.setFrame`). */
const POINT_SIZE = 1.4;
/** Opacity of one sprite while only the first tier is shown. */
const POINT_GAIN = 0.4;
/** µm in front of / behind the orbit centre over which dust dims to `FAR_DIM`. */
const DEPTH_RANGE = 350;
const FAR_DIM = 0.3;
/** Intro scatter shell (× bbox half-diagonal) and spiral (rad) unwound on the way in. */
const SCATTER_MIN = 0.5;
const SCATTER_MAX = 1.6;
const SWIRL = 1.2;
/** Dust fades up over the first ms of the intro so it does not pop. */
const FADE_IN_MS = 300;
const LUT_N = 256;

/** Intro flight of the first tier: `clock` = assembly ms (`INTRO.assembleMs` = every sprite landed). */
export interface Assembly {
  clock: { value: number };
  /** Bbox centre and half-diagonal, source units. */
  center: readonly [number, number, number];
  radius: number;
}

/**
 * Background dust: each LOD tier is one instanced sprite batch. Tiers are disjoint uniform samples,
 * so adding one only refines the grain — per-sprite gain drops to keep total brightness constant.
 */
export class CloudLayer {
  readonly group = new Group();
  private readonly gain = uniform(POINT_GAIN);
  private first = 0;
  private tiers = Number.POSITIVE_INFINITY;

  /**
   * `worldScale` = µm per source unit; the sprite material scales by the object's world matrix.
   * With `assembly`, the first tier flies in from a scatter shell (later tiers just appear).
   */
  constructor(
    private readonly worldScale: number,
    private readonly assembly?: Assembly,
  ) {
    this.group.name = 'cloud';
  }

  add(pos: Float32Array) {
    const n = pos.length / 3;
    if (!n) return;
    const mat = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
    const target = instancedBufferAttribute(new InstancedBufferAttribute(pos, 3)) as unknown as Node<'vec3'>;
    const flight = !this.first && this.assembly ? assemble(target, this.assembly) : undefined;
    mat.positionNode = flight?.position ?? target;
    mat.scaleNode = uniform(POINT_SIZE / this.worldScale);
    mat.colorNode = color(DUST_COLOR);
    // positionView.z < 0 in front of the camera; orbit target is the origin
    const behind = positionView.z.negate().sub(length(cameraPosition)).div(DEPTH_RANGE);
    const depthDim = mix(1, FAR_DIM, smoothstep(-1, 1, behind));
    const disc = oneMinus(smoothstep(0.15, 0.5, length(uv().sub(0.5))));
    mat.opacityNode = disc
      .mul(depthDim)
      .mul(this.gain)
      .mul(flight?.opacity ?? 1);

    const sprite = new Sprite(mat);
    sprite.count = n;
    sprite.frustumCulled = false;
    this.group.add(sprite);
    this.first ||= n;
    this.setTiers(this.tiers);
  }

  /** Tiers added so far. */
  get loaded() {
    return this.group.children.length;
  }

  /** Show only the first `n` tiers (quality presets); later `add`s respect the cap. */
  setTiers(n: number) {
    this.tiers = n;
    let shown = 0;
    this.group.children.forEach((c, i) => {
      c.visible = i < n;
      if (c.visible) shown += (c as Sprite).count;
    });
    if (shown) this.gain.value = (POINT_GAIN * this.first) / shown;
  }
}

/** Per sprite: scatter point on a shell → own position, staggered, eased, unwinding a spiral about y. */
function assemble(target: Node<'vec3'>, a: Assembly) {
  const lutTex = new DataTexture(bezierLut(EASE_IN_OUT, LUT_N), LUT_N, 1, RedFormat, FloatType);
  lutTex.needsUpdate = true;
  const clock = uniform(0).onFrameUpdate(() => a.clock.value);
  const h = (salt: number) => hash(instanceIndex.add(salt));

  // uniform direction on the sphere, distance within the shell
  const z = h(1).mul(2).sub(1);
  const phi = h(2).mul(2 * Math.PI);
  const rxy = sqrt(oneMinus(z.mul(z)));
  const dist = mix(SCATTER_MIN, SCATTER_MAX, h(3)).mul(a.radius);
  const center = vec3(...a.center);
  const start = center.add(vec3(rxy.mul(cos(phi)), z, rxy.mul(sin(phi))).mul(dist));

  const k = clamp(clock.sub(h(4).mul(INTRO.delayMs)).div(INTRO.flightMs), 0, 1);
  // on-screen movement → ease-in-out, via the LUT, linear between samples
  const x = k.mul(LUT_N - 1);
  const i0 = int(floor(x));
  const i1 = int(
    floor(x)
      .add(1)
      .min(LUT_N - 1),
  );
  const e = mix(textureLoad(lutTex, ivec2(i0, 0)).x, textureLoad(lutTex, ivec2(i1, 0)).x, fract(x));

  const p = mix(start, target, e).sub(center);
  const ang = oneMinus(e).mul(SWIRL);
  const c = cos(ang);
  const s = sin(ang);
  const position = center.add(vec3(p.x.mul(c).sub(p.z.mul(s)), p.y, p.x.mul(s).add(p.z.mul(c))));
  const opacity = clamp(clock.div(FADE_IN_MS), 0, 1).mul(mix(0.35, 1, e));
  return { position, opacity };
}
