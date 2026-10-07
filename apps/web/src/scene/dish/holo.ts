import type { BBox, NeuropilSet } from '@fly/data';
import { type Decision, FLY_LEN, mulberry32, OPERATIONS, PATHS } from '@fly/sim';
import { color, instancedBufferAttribute, length, oneMinus, smoothstep, uniform, uv } from 'three/tsl';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedBufferAttribute,
  Matrix4,
  Mesh,
  type Node,
  RingGeometry,
  Sprite,
  SpriteNodeMaterial,
  Vector3,
} from 'three/webgpu';
import { glassMaterial } from '../layers/shells';
import { centroids, holoFrame, hopSites, type Side, sample, site, type Vec3 } from './hologram';
import { BONE, glow, SAFFRON } from './materials';
import type { Op } from './verdict';

/** The CNS's width (brain, eye to eye), mm, and its centre's height over the floor (its underside ≈ 2 fly lengths up). */
const WIDTH = 1.3 * FLY_LEN;
const LIFT = 2.5 * FLY_LEN;
/** Dots sampled from the dust cloud; their diameter and opacity (mm, 0..1). */
const DOTS = 4000;
const DOT_MM = 0.035;
const DOT_GAIN = 0.45;
const DUST = 0xb4bccc;
const IRIS = 0x8052ff;
/** Shell glass: iris rim at ≈ 15 %. */
const SHELL = { rimPower: 4, rimGain: 0.15, fill: 0.004 };
/** Spring lag of the follow (wall ms to close ~63 % of the gap). */
const LAG_MS = 220;
/** Path nodes: resting / flashing diameter (mm) and brightness (× colour; > 1 blooms). */
const NODE_MM = 0.07;
const NODE_REST = 0.35;
const NODE_HOT = 2.2;
/** Op marks: ring radius (mm). */
const MARK_R = 0.24;
const ASH = 0x6e6e6e;
/** Sunk into the head (the zoom): its size then, × the floating one. */
const SUNK = 0.3;

export interface BrainData {
  cloud: Float32Array;
  shells: NeuropilSet;
  regions: NeuropilSet;
  bbox: BBox;
}

interface PathNode {
  type: string;
  sprite: Sprite;
  heat: { value: number };
}

/**
 * The fly's CNS as a glass hologram over her back, oriented like her body (brain forward, VNC
 * behind), following with a soft spring. Holds a node per cell type of the decision paths (live
 * spikes flash them) and the operation marks.
 */
export class HoloView {
  readonly root = new Group();
  /** EM source units → the fly frame (see `holoFrame`). */
  private readonly brain = new Group();
  private readonly cents: Map<string, Vec3>;
  private readonly nodes = new Map<string, PathNode>();
  private readonly marks = new Map<Op, Mesh>();
  private readonly v = new Vector3();
  /** Half extents seen from the front (mm, floating size): across, up, deep — like the brain view's framing box. */
  readonly half: Vec3;
  private placed = false;
  private yaw = 0;
  /** Where it floats (the follow's spring state); the zoom pulls it from there into the head. */
  private readonly float = new Vector3();
  private sunk = 0;
  private readonly head = new Vector3();

  constructor(d: BrainData) {
    const f = holoFrame(d.bbox, WIDTH);
    const s = WIDTH / ((d.bbox.max[0] as number) - (d.bbox.min[0] as number));
    this.half = d.bbox.min.map((v, i) => (((d.bbox.max[i] as number) - v) * s) / 2) as Vec3;
    this.brain.matrixAutoUpdate = false;
    this.brain.matrix.copy(new Matrix4().set(...(f.rows as Parameters<Matrix4['set']>)));
    this.root.add(this.brain);
    this.cents = centroids(d.regions);

    const dots = sample(d.cloud, DOTS, mulberry32(8));
    this.brain.add(sprites(dots, DOT_MM / s, color(DUST), DOT_GAIN));

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(d.shells.pos, 3));
    geo.setIndex(new BufferAttribute(d.shells.index, 1));
    geo.computeVertexNormals();
    this.brain.add(new Mesh(geo, glassMaterial(IRIS, SHELL)));

    for (const p of Object.values(PATHS))
      p.hops.forEach((h, i) => {
        if (this.nodes.has(h.type)) return;
        const at = hopSites(p, 'L', this.cents)[i];
        if (!at) return;
        const heat = uniform(0);
        const mat = new SpriteNodeMaterial({
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
        });
        mat.colorNode = color(BONE).mul(heat.mul(NODE_HOT - NODE_REST).add(NODE_REST));
        mat.opacityNode = disc();
        const sprite = new Sprite(mat);
        sprite.position.set(...at);
        sprite.scale.setScalar(NODE_MM / s);
        this.brain.add(sprite);
        this.nodes.set(h.type, { type: h.type, sprite, heat });
      });

    for (const [op, o] of Object.entries(OPERATIONS) as [Op, (typeof OPERATIONS)[Op]][]) {
      const at = site(this.cents, o.region, 'L');
      if (!at) continue;
      const ring = new Mesh(
        new RingGeometry(0.8, 1, 48),
        glow(o.mode === 'off' ? ASH : SAFFRON, o.mode === 'off' ? 2.4 : 1.8),
      );
      // rings stand in the fly frame facing up-and-back (towards a camera behind and above)
      const p = f.map(at);
      ring.position.set(...p);
      ring.rotation.set(-Math.PI / 2, 0, 0);
      ring.scale.setScalar(MARK_R);
      ring.visible = false;
      this.root.add(ring);
      this.marks.set(op, ring);
    }
  }

  /** Follows the fly at scene (x, z) with heading `h`; `dt` wall ms (0 = jump there). */
  follow(x: number, z: number, h: number, dt: number): void {
    const k = this.placed && dt > 0 ? 1 - Math.exp(-dt / LAG_MS) : 1;
    this.placed = true;
    const r = this.float;
    r.x += (x - r.x) * k;
    r.z += (z - r.z) * k;
    r.y = LIFT;
    const dy = Math.atan2(Math.sin(h - this.yaw), Math.cos(h - this.yaw));
    this.yaw += dy * k;
    this.root.rotation.y = this.yaw;
    this.place();
  }

  /** The zoom: `k` = 0 floating … 1 shrunk into the fly's `head` (world). */
  sink(k: number, head: Vector3): void {
    this.sunk = k;
    this.head.copy(head);
    this.place();
  }

  /** Heading it faces (radians, the fly's, lagged). */
  get facing(): number {
    return this.yaw;
  }

  /** Its scale at sink `k` (× the floating size). */
  static scaleAt(k: number): number {
    return 1 + (SUNK - 1) * k;
  }

  private place(): void {
    this.root.position.lerpVectors(this.float, this.head, this.sunk);
    this.root.scale.setScalar(HoloView.scaleAt(this.sunk));
  }

  /** Each path node's activity (0..1) by cell type. */
  heat(levels: ReadonlyMap<string, number>): void {
    for (const n of this.nodes.values()) n.heat.value = levels.get(n.type) ?? 0;
  }

  /** Marks of the operations in force. */
  setMarks(on: ReadonlySet<Op>): void {
    for (const [op, m] of this.marks) m.visible = on.has(op);
  }

  /** A decision path's hop points in world space (side from the stimulus); missing neuropils are skipped. */
  path(d: Decision, side: Side | null): Vector3[] {
    this.root.updateMatrixWorld();
    return hopSites(PATHS[d], side, this.cents)
      .filter((p): p is Vec3 => !!p)
      .map((p) => this.brain.localToWorld(this.v.set(...p)).clone());
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as { dispose(): void }).dispose();
    });
  }
}

/** A soft round sprite. */
function disc(): Node<'float'> {
  return oneMinus(smoothstep(0.15, 0.5, length(uv().sub(0.5))));
}

/** Instanced round sprites at `pos` (parent units), `size` across. */
function sprites(pos: Float32Array, size: number, c: Node<'color'>, gain: number): Sprite {
  const mat = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  mat.positionNode = instancedBufferAttribute(
    new InstancedBufferAttribute(pos, 3),
  ) as unknown as Node<'vec3'>;
  mat.scaleNode = uniform(size);
  mat.colorNode = c;
  mat.opacityNode = disc().mul(gain);
  const s = new Sprite(mat);
  s.count = pos.length / 3;
  s.frustumCulled = false;
  return s;
}
