import type { BBox, NeuropilRange, NeuropilSet } from '@fly/data';
import { type Decision, FLY_LEN, mulberry32, OPERATIONS, PATHS } from '@fly/sim';
import { color, instancedBufferAttribute, length, oneMinus, smoothstep, uniform, uv } from 'three/tsl';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Color,
  Group,
  InstancedBufferAttribute,
  Matrix4,
  Mesh,
  type Node,
  PlaneGeometry,
  RingGeometry,
  Sprite,
  SpriteNodeMaterial,
  Vector3,
} from 'three/webgpu';
import type { Site } from '../../state/trial';
import { glassMaterial } from '../layers/shells';
import { centroids, holoFrame, hopSites, type Side, sample, site, type Vec3 } from './hologram';
import { BONE, glow, SAFFRON } from './materials';
import {
  approach,
  boxOf,
  chosen,
  grown,
  type Look,
  PULSE,
  QUIET,
  rangeOf,
  regionLook,
  type Tint,
  tagDots,
  wholeRim,
} from './surgery';

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
/** Op marks: ring radius (mm; ≥ 10 px at rest, SURGEON-SHAPE §Hologram). */
const MARK_R = 0.48;
const ASH = 0x6e6e6e;
/** The op regions' shell tints. */
const TINT: Record<Tint, number> = { bone: BONE, ash: ASH, saffron: SAFFRON };
/** Grow / shrink (ms to ~95 %), region light in / out, the choose pulse settling (SURGEON-SHAPE §Motion). */
const GROW_MS = 320;
const SHRINK_MS = 260;
const LIGHT_IN_MS = 120;
const LIGHT_OUT_MS = 200;
const SETTLE_MS = 400;
/** Op region shells: a thicker rim than the base shell's, so a small region reads. */
const REGION_RIM_POWER = 2;
/** The dust while the op list is open (× rest), so a lit region reads. */
const DUST_OPEN = 0.6;
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

/** An op region's uniforms: shell rim, fill and tint, its dust's brightness (× rest). */
const regionUniforms = () => ({
  rim: uniform(0),
  fill: uniform(0),
  tint: uniform(new Color(BONE)),
  dust: uniform(1),
});

/** An op region: its shell over the base one, its dust apart, and its look now. */
interface Region extends ReturnType<typeof regionUniforms> {
  name: string;
  /** Its centre (source units), for the «здесь» tag. */
  at: Vec3;
  now: Look;
  /** Wall ms left of the choose pulse. */
  settle: number;
}

/** What the op slot asks of the hologram (SURGEON-SHAPE §Hologram). */
export interface Surgery {
  listing: boolean;
  lit: Site | 'all' | null;
  operated: Site | null;
  phone: boolean;
}

export interface HoloOptions {
  reducedMotion: boolean;
  /** Snaps: every change lands at once. */
  still: boolean;
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
  /** Op marks by `region:mode`. */
  private readonly marks = new Map<string, Mesh>();
  private readonly regions = new Map<string, Region>();
  /** The dust's brightness (× rest; dims while the list is open). */
  private readonly dust = uniform(1);
  /** The base shell's rim (× rest; the brain row lights all of it). */
  private readonly whole = uniform(1);
  private surgery: Surgery = { listing: false, lit: null, operated: null, phone: false };
  /** Set by the first `operate`: what it finds in force was not chosen just now. */
  private shown = false;
  /** The op list's grow (× rest) now. */
  private grow = 1;
  private readonly tint = new Color();
  private readonly v = new Vector3();
  /** Half extents seen from the front (mm, floating size): across, up, deep — like the brain view's framing box. */
  readonly half: Vec3;
  private placed = false;
  private yaw = 0;
  /** Where it floats (the follow's spring state); the zoom pulls it from there into the head. */
  private readonly float = new Vector3();
  private sunk = 0;
  private readonly head = new Vector3();
  /** The shells' rim gain (the decision flash raises it). */
  private readonly rim = uniform(SHELL.rimGain);
  /** The CNS box corners (source units), for its screen box. */
  private readonly corners: Vector3[];

  constructor(
    d: BrainData,
    private readonly o: HoloOptions = { reducedMotion: false, still: false },
  ) {
    const f = holoFrame(d.bbox, WIDTH);
    const s = WIDTH / ((d.bbox.max[0] as number) - (d.bbox.min[0] as number));
    this.half = d.bbox.min.map((v, i) => (((d.bbox.max[i] as number) - v) * s) / 2) as Vec3;
    this.brain.matrixAutoUpdate = false;
    this.brain.matrix.copy(new Matrix4().set(...(f.rows as Parameters<Matrix4['set']>)));
    this.root.add(this.brain);
    this.cents = centroids(d.regions);

    // the op regions: a shell each over the base shell, and the dust inside their boxes apart
    const named = [...new Set(Object.values(OPERATIONS).map((o) => o.region))].flatMap((name) => {
      const r = rangeOf(d.regions, name);
      const at = site(this.cents, name, 'L');
      return r && at ? [{ name, r, at }] : [];
    });
    const dots = sample(d.cloud, DOTS, mulberry32(8));
    const tags = tagDots(
      dots,
      named.map((n) => boxOf(d.regions, n.r)),
    );
    const groups: number[][] = [[], ...named.map(() => [])];
    tags.forEach((k, i) => {
      groups[k]?.push(dots[i * 3] as number, dots[i * 3 + 1] as number, dots[i * 3 + 2] as number);
    });
    const dot = DOT_MM / s;
    const dust = (k: number, gain: Node<'float'>) => {
      const g = groups[k] as number[];
      if (g.length) this.brain.add(sprites(Float32Array.from(g), dot, color(DUST), gain.mul(DOT_GAIN)));
    };
    dust(0, this.dust);

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(d.shells.pos, 3));
    geo.setIndex(new BufferAttribute(d.shells.index, 1));
    geo.computeVertexNormals();
    this.brain.add(new Mesh(geo, glassMaterial(IRIS, { ...SHELL, rimGain: this.rim.mul(this.whole) })));

    named.forEach(({ name, r, at }, k) => {
      const reg: Region = {
        name,
        at,
        ...regionUniforms(),
        now: { ...QUIET },
        settle: 0,
      };
      dust(k + 1, this.dust.mul(reg.dust));
      const glass = glassMaterial(reg.tint, { rimPower: REGION_RIM_POWER, rimGain: reg.rim, fill: reg.fill });
      this.brain.add(new Mesh(regionGeometry(d.regions, r), glass));
      this.regions.set(name, reg);
    });
    const { min, max } = d.bbox;
    this.corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
      (i) =>
        new Vector3(
          (i & 1 ? max : min)[0] as number,
          (i & 2 ? max : min)[1] as number,
          (i & 4 ? max : min)[2] as number,
        ),
    );

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

    for (const o of Object.values(OPERATIONS)) {
      const key = `${o.region}:${o.mode}`;
      const at = site(this.cents, o.region, 'L');
      if (!at || this.marks.has(key)) continue;
      const off = o.mode === 'off';
      const ring = new Mesh(new RingGeometry(0.8, 1, 48), glow(off ? ASH : SAFFRON, off ? 2.4 : 1.8));
      // switched off: a diagonal strike across the ring (⊘)
      if (off) {
        const bar = new Mesh(new PlaneGeometry(1.8, 0.2), ring.material);
        bar.rotation.z = Math.PI / 4;
        ring.add(bar);
      }
      // rings stand in the fly frame facing up-and-back (towards a camera behind and above)
      const p = f.map(at);
      ring.position.set(...p);
      ring.rotation.set(-Math.PI / 2, 0, 0);
      ring.scale.setScalar(MARK_R);
      ring.visible = false;
      this.root.add(ring);
      this.marks.set(key, ring);
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
    // the list's grow gives way as it sinks into the head
    this.root.scale.setScalar(HoloView.scaleAt(this.sunk) * (1 + (this.grow - 1) * (1 - this.sunk)));
  }

  /** What the op slot shows: grown while listing, the hovered row's region, the op in force. */
  operate(s: Surgery): void {
    const was = this.shown ? this.surgery.operated : undefined;
    this.surgery = s;
    this.shown = true;
    const now = s.operated;
    for (const [key, m] of this.marks) m.visible = !!now && key === `${now.region}:${now.mode}`;
    // a fresh choice pulses its region before it settles into the mark
    const reg = now && chosen(was, now) ? this.regions.get(now.region) : undefined;
    if (reg && !this.o.reducedMotion && !this.o.still) {
      reg.now = { ...PULSE };
      reg.tint.value.set(TINT[PULSE.tint]);
      reg.settle = SETTLE_MS;
    }
    if (this.o.still) this.tick(0);
  }

  /** Eases the grow and the regions' looks over `dt` wall ms (it runs while the dish is paused too). */
  tick(dt: number): void {
    const { listing, lit, operated, phone } = this.surgery;
    const now = this.o.still || this.o.reducedMotion;
    const ease = (cur: number, to: number, ms: number) => approach(cur, to, dt, now ? 0 : ms / 3);
    const g = this.o.reducedMotion ? 1 : grown(listing, phone);
    this.grow = ease(this.grow, g, g > this.grow ? GROW_MS : SHRINK_MS);
    this.dust.value = ease(this.dust.value, listing ? DUST_OPEN : 1, LIGHT_OUT_MS);
    this.whole.value = ease(this.whole.value, wholeRim(lit), LIGHT_IN_MS);
    for (const r of this.regions.values()) {
      const want = regionLook(r.name, lit, operated);
      r.settle = Math.max(0, r.settle - dt);
      const ms = r.settle > 0 ? SETTLE_MS : want.rim > r.now.rim ? LIGHT_IN_MS : LIGHT_OUT_MS;
      r.now = {
        tint: want.tint,
        rim: ease(r.now.rim, want.rim, ms),
        fill: ease(r.now.fill, want.fill, ms),
        dust: ease(r.now.dust, want.dust, ms),
      };
      const c = r.tint.value;
      this.tint.set(TINT[want.tint]);
      c.setRGB(ease(c.r, this.tint.r, ms), ease(c.g, this.tint.g, ms), ease(c.b, this.tint.b, ms));
      r.rim.value = r.now.rim;
      r.fill.value = r.now.fill;
      r.dust.value = r.now.dust;
    }
    this.place();
  }

  /** The lit region's centre in canvas px (the «здесь» tag); null with none, the whole brain, or off screen. */
  litSpot(camera: Camera, w: number, h: number): { x: number; y: number } | null {
    const l = this.surgery.lit;
    const r = l && l !== 'all' ? this.regions.get(l.region) : undefined;
    if (!r || this.sunk > 0) return null;
    this.root.updateMatrixWorld();
    const p = this.brain.localToWorld(this.v.set(...r.at)).project(camera);
    if (p.z > 1) return null;
    return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
  }

  /** The decision flash: rim gain × `k` (1 = rest). */
  flare(k: number): void {
    this.rim.value = SHELL.rimGain * k;
  }

  /** Its box on screen (px in a `w` × `h` canvas); null sunk into the head or behind the camera. */
  screenBox(camera: Camera, w: number, h: number): { x0: number; y0: number; x1: number; y1: number } | null {
    if (this.sunk > 0) return null;
    this.root.updateMatrixWorld();
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const c of this.corners) {
      const p = this.v.copy(c).applyMatrix4(this.brain.matrixWorld).project(camera);
      if (p.z > 1) return null;
      const x = ((p.x + 1) / 2) * w;
      const y = ((1 - p.y) / 2) * h;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1 };
  }

  /** Each path node's activity (0..1) by cell type. */
  heat(levels: ReadonlyMap<string, number>): void {
    for (const n of this.nodes.values()) n.heat.value = levels.get(n.type) ?? 0;
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

/** A named mesh of `set` on its own (positions copied, indices made local). */
function regionGeometry(set: NeuropilSet, r: NeuropilRange): BufferGeometry {
  const geo = new BufferGeometry();
  const pos = set.pos.slice(r.vertStart * 3, (r.vertStart + r.vertCount) * 3);
  const index = set.index.slice(r.indexStart, r.indexStart + r.indexCount).map((i) => i - r.vertStart);
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setIndex(new BufferAttribute(index, 1));
  geo.computeVertexNormals();
  return geo;
}

/** Instanced round sprites at `pos` (parent units), `size` across. */
function sprites(pos: Float32Array, size: number, c: Node<'color'>, gain: Node<'float'>): Sprite {
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
