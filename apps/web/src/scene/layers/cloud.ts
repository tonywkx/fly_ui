import {
  cameraPosition,
  color,
  instancedBufferAttribute,
  length,
  mix,
  oneMinus,
  positionView,
  smoothstep,
  uniform,
  uv,
} from 'three/tsl';
import { AdditiveBlending, Group, InstancedBufferAttribute, Sprite, SpriteNodeMaterial } from 'three/webgpu';

const DUST_COLOR = 0xb4bccc;
/** Sprite diameter in µm (world units after `Engine.setFrame`). */
const POINT_SIZE = 1.4;
/** Opacity of one sprite while only the first tier is shown. */
const POINT_GAIN = 0.4;
/** µm in front of / behind the orbit centre over which dust dims to `FAR_DIM`. */
const DEPTH_RANGE = 350;
const FAR_DIM = 0.3;

/**
 * Background dust: each LOD tier is one instanced sprite batch. Tiers are disjoint uniform samples,
 * so adding one only refines the grain — per-sprite gain drops to keep total brightness constant.
 */
export class CloudLayer {
  readonly group = new Group();
  private readonly gain = uniform(POINT_GAIN);
  private first = 0;
  private total = 0;

  /** `worldScale` = µm per source unit; the sprite material scales by the object's world matrix. */
  constructor(private readonly worldScale: number) {
    this.group.name = 'cloud';
  }

  add(pos: Float32Array) {
    const n = pos.length / 3;
    if (!n) return;
    const mat = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
    mat.positionNode = instancedBufferAttribute(new InstancedBufferAttribute(pos, 3));
    mat.scaleNode = uniform(POINT_SIZE / this.worldScale);
    mat.colorNode = color(DUST_COLOR);
    // positionView.z < 0 in front of the camera; orbit target is the origin
    const behind = positionView.z.negate().sub(length(cameraPosition)).div(DEPTH_RANGE);
    const depthDim = mix(1, FAR_DIM, smoothstep(-1, 1, behind));
    const disc = oneMinus(smoothstep(0.15, 0.5, length(uv().sub(0.5))));
    mat.opacityNode = disc.mul(depthDim).mul(this.gain);

    const sprite = new Sprite(mat);
    sprite.count = n;
    sprite.frustumCulled = false;
    this.group.add(sprite);

    this.first ||= n;
    this.total += n;
    this.gain.value = (POINT_GAIN * this.first) / this.total;
  }
}
