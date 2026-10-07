import {
  type Action,
  ARENA_R,
  type ItemKind,
  PATHS,
  SWAT_MS,
  SWAT_R,
  type World,
  type WorldEvent,
} from '@fly/sim';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
  length,
  oneMinus,
  pass,
  positionGeometry,
  smoothstep,
  color as tint,
  uniform,
  uv,
  vec3,
  vec4,
} from 'three/tsl';
import {
  AdditiveBlending,
  AgXToneMapping,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Group,
  LineBasicNodeMaterial,
  LineSegments,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RenderPipeline,
  RingGeometry,
  Scene,
  Sprite,
  SpriteNodeMaterial,
  Vector2,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import type { Backend } from '../engine';
import { lerpPose, type Pose, posePosition } from '../intro';
import type { Preset } from '../quality';
import { arena } from './arena';
import { FlyView } from './fly';
import { type Band, frame, type Lens, NO_BAND } from './frame';
import { type BrainData, HoloView } from './holo';
import type { Vec3 } from './hologram';
import { type ItemView, itemView } from './items';
import type { DecisionEvent } from './loop';
import { BONE, dark, glow, SAFFRON } from './materials';
import { floorHit, type Spot } from './place';
import { cut, RUN_MS, threadAt } from './thread';
import { Trail } from './trail';
import type { Op } from './verdict';
import { facing, seamDistance, type ZoomDir, zoomAt } from './zoom';

const FOV = 30;
/** Start pitch and its clamp (deg above the floor). */
const PITCH = 40;
const PITCH_MIN = 25;
const PITCH_MAX = 60;
/** Share of the viewport the dish fills: its (foreshortened) height on desktop, its width on phones. */
const LENS: Lens = { fov: FOV, pitch: PITCH, diameter: 2 * ARENA_R, fillH: 0.6, fillW: 0.92 };
/** Time constant (ms) of the picture's glide when the chrome changes size. */
const LIFT_MS = 90;
/** Zoom range as distance factors of the fitted one (fly ≈ 200 … 60 px around ≈ 90). */
const ZOOM_IN = 0.45;
const ZOOM_OUT = 1.5;
const BLOOM = { strength: 0.45, radius: 0.15, threshold: 1.0 };
/** Trail points closer than this (mm) are merged. */
const TRAIL_STEP = 0.03;
/** Takeoff ring: life (sim ms) and final radius (mm). */
const RING_MS = 600;
const RING_R = 1.6;
/** Aim ring under the cursor (mm) and the drag ghost's opacity. */
const AIM_R = 1;
const GHOST = 0.6;
/** The ghost's plume runs on wall time at ×1/6, like the dish. */
const SLOW_GHOST = 6;
/** Decision thread: most points it can have, its brightness (> 1 blooms) and the head's diameter (mm). */
const THREAD_MAX = 16;
const THREAD_GAIN = 1.4;
const HEAD_MM = 0.18;
/** Draw order: the zoom's veil over the dish, the hologram over the veil. */
const VEIL_ORDER = 10;
const HOLO_ORDER = 20;
/** Hologram box before it loads (mm, front half extents) — the zoom still has a framing. */
const HALF_GUESS: Vec3 = [1.6, 0.9, 1.4];

export interface DishSceneOptions {
  forceWebGL: boolean;
  reducedMotion: boolean;
  /** Snaps: a decision's thread stays drawn whole instead of running and fading. */
  still?: boolean;
  /** Arrived from the brain view: black until `arrive()` flies out of the head. */
  arriving?: boolean;
}

/** A camera on its orbit (`Pose`) round a target. */
interface Shot {
  pose: Pose;
  target: Vector3;
}

interface Zoom {
  dir: ZoomDir;
  /** Wall ms since it began, or frozen there (snaps). */
  age: number;
  frozen: boolean;
  /** The dish end of the flight (the user's camera on the way in, the fitted framing on the way out). */
  dish: Shot;
  done?: () => void;
}

/** The Terrarium view: dish, glass fly, trail, items and hands, bloom; draws a `World` each frame. */
export class DishScene {
  private readonly renderer: WebGPURenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 500);
  private readonly controls: OrbitControls;
  private readonly pipeline: RenderPipeline;
  private readonly plain: Node;
  private readonly bloomed: Node;
  private readonly resize = new ResizeObserver(() => this.fit());
  private readonly fly = new FlyView();
  private readonly items = new Map<number, ItemView>();
  private readonly itemRoot = new Group();
  private readonly trail = new Trail();
  private readonly trailPos: BufferAttribute;
  private readonly trailRgb: BufferAttribute;
  private readonly trailLines: LineSegments;
  private readonly rings: { mesh: Mesh; t: number }[] = [];
  private readonly ringGeo = new RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2);
  private readonly shadow = disc();
  private readonly swatter = disc();
  private readonly aimRing = new Mesh(new RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2), glow(BONE, 0.35));
  private ghost: { kind: ItemKind; view: ItemView } | null = null;
  private holo: HoloView | null = null;
  private marks = new Set<Op>();
  /** The running thread: its decision and wall ms since. */
  private thread: { e: DecisionEvent; age: number } | null = null;
  private readonly threadPos = new BufferAttribute(new Float32Array(THREAD_MAX * 3), 3);
  private readonly threadLine: LineSegments;
  private readonly threadAlpha = uniform(0);
  private readonly head: Sprite;
  /** Zoom: black over the dish (not the hologram), and over everything. */
  private readonly veilAlpha = uniform(0);
  private readonly veil: Mesh;
  private readonly lit = uniform(1);
  private zoom: Zoom | null = null;
  private readonly ray = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly v = new Vector3();
  private lastTrail: { x: number; y: number; a: Action } | null = null;
  private fitted = 0;
  /** Chrome over the picture (`frameBand`) and the view offset easing toward the one it asks for. */
  private band = NO_BAND;
  private shift = { x: 0, y: 0 };
  private shiftTo = { x: 0, y: 0 };
  private lastNow = 0;
  private disposed = false;
  private initialized: Promise<unknown> | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly opts: DishSceneOptions,
  ) {
    this.renderer = new WebGPURenderer({ antialias: false, forceWebGL: opts.forceWebGL });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = AgXToneMapping;
    this.renderer.domElement.className = 'block size-full outline-none';
    host.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !opts.reducedMotion;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = ((90 - PITCH_MAX) * Math.PI) / 180;
    this.controls.maxPolarAngle = ((90 - PITCH_MIN) * Math.PI) / 180;

    const geo = new BufferGeometry();
    const n = this.trail.capacity * 2;
    this.trailPos = new BufferAttribute(new Float32Array(n * 3), 3);
    this.trailRgb = new BufferAttribute(new Float32Array(n * 3), 3);
    geo.setAttribute('position', this.trailPos);
    geo.setAttribute('color', this.trailRgb);
    const lineMat = new LineBasicNodeMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.trailLines = new LineSegments(geo, lineMat);
    this.trailLines.position.y = 0.003;
    this.trailLines.frustumCulled = false;

    this.scene.add(
      arena(),
      this.trailLines,
      this.itemRoot,
      this.fly.root,
      this.shadow.root,
      this.swatter.root,
      this.aimRing,
    );
    this.aimRing.visible = false;
    this.aimRing.scale.setScalar(AIM_R);

    const tg = new BufferGeometry();
    tg.setAttribute('position', this.threadPos);
    const tm = new LineBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    tm.colorNode = tint(SAFFRON).mul(THREAD_GAIN);
    tm.opacityNode = this.threadAlpha;
    this.threadLine = new LineSegments(tg, tm);
    this.threadLine.frustumCulled = false;
    const hm = new SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
    hm.colorNode = tint(SAFFRON).mul(2.5);
    hm.opacityNode = oneMinus(smoothstep(0.1, 0.5, length(uv().sub(0.5)))).mul(this.threadAlpha);
    this.head = new Sprite(hm);
    this.head.scale.setScalar(HEAD_MM);
    this.threadLine.visible = this.head.visible = false;
    this.scene.add(this.threadLine, this.head);

    // a screen quad straight in clip space: never culled, drawn between the dish and the hologram
    const vm = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false });
    vm.vertexNode = vec4(positionGeometry.xy, 0, 1);
    vm.colorNode = vec3(0);
    vm.opacityNode = this.veilAlpha;
    this.veil = new Mesh(new PlaneGeometry(2, 2), vm);
    this.veil.frustumCulled = false;
    this.veil.renderOrder = VEIL_ORDER;
    this.veil.visible = false;
    this.scene.add(this.veil);
    if (opts.arriving) this.lit.value = 0;

    const scenePass = pass(this.scene, this.camera, { samples: 4 });
    const color = scenePass.getTextureNode('output');
    this.plain = color.mul(this.lit);
    this.bloomed = color.add(bloom(color, BLOOM.strength, BLOOM.radius, BLOOM.threshold)).mul(this.lit);
    this.pipeline = new RenderPipeline(this.renderer, this.bloomed);
  }

  async init(): Promise<Backend> {
    this.initialized = this.renderer.init();
    await this.initialized;
    if (!this.disposed) {
      this.fit();
      this.resize.observe(this.host);
    }
    return (this.renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  }

  /** Bloom and pixel-ratio cap of a quality preset. */
  applyQuality(p: Preset): void {
    const out = p.bloom ? this.bloomed : this.plain;
    if (this.pipeline.outputNode !== out) {
      this.pipeline.outputNode = out;
      this.pipeline.needsUpdate = true;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, p.pixelRatio));
    this.fit();
  }

  /** Calls `fn(now)` every display frame. */
  loop(fn: (now: number) => void): void {
    this.renderer.setAnimationLoop((now) => {
      fn(now);
      this.ease(now - this.lastNow);
      this.lastNow = now;
      if (!this.zoom) this.controls.update();
      this.pipeline.render();
    });
  }

  /** Mirrors the world at sim time `t` (after `events` happened on the way there); `marked` = an operation is on. */
  sync(world: World, action: Action, t: number, events: readonly WorldEvent[], marked = false): void {
    const f = world.fly;
    for (const e of events) {
      if (e.kind === 'takeoff') {
        this.fly.takeoffAt(e.t);
        this.trail.gap();
        this.ring(e.x, e.y, e.t);
      } else if (e.kind === 'land') this.fly.landAt(e.t);
      else if (e.kind === 'hit' || e.kind === 'reassemble') this.trail.gap();
    }
    if (f.air === 0 && f.down === 0) this.pushTrail(t, f.x, f.y, action);
    this.fly.update(f, action, t, f.down > 0, marked);

    const live = new Set<number>();
    for (const it of world.items) {
      live.add(it.id);
      let v = this.items.get(it.id);
      if (!v) {
        v = itemView(it);
        this.items.set(it.id, v);
        this.itemRoot.add(v.root);
      }
      v.update(it, t);
    }
    for (const [id, v] of this.items)
      if (!live.has(id)) {
        this.itemRoot.remove(v.root);
        this.items.delete(id);
      }

    const n = this.trail.fill(t, this.trailPos.array as Float32Array, this.trailRgb.array as Float32Array);
    this.trailLines.geometry.setDrawRange(0, n * 2);
    this.trailPos.needsUpdate = true;
    this.trailRgb.needsUpdate = true;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i] as { mesh: Mesh; t: number };
      const k = (t - r.t) / RING_MS;
      if (k >= 1 || k < 0) {
        this.scene.remove(r.mesh);
        (r.mesh.material as { dispose(): void }).dispose();
        this.rings.splice(i, 1);
        continue;
      }
      r.mesh.scale.setScalar(0.3 + (RING_R - 0.3) * k);
      (r.mesh.material as { opacity: number }).opacity = 1 - k;
    }

    const { shadow: sh, swatter: sw } = world.hands;
    this.shadow.show(sh ? { x: sh.x, y: sh.y, r: sh.r } : null);
    this.swatter.show(sw ? { x: sw.x, y: sw.y, r: (SWAT_R * sw.t) / SWAT_MS } : null);
  }

  /** The brain hologram, once its chunks are in. */
  setBrain(d: BrainData): void {
    if (this.disposed || this.holo) return;
    this.holo = new HoloView(d);
    this.holo.root.traverse((o) => {
      o.renderOrder = HOLO_ORDER;
    });
    this.holo.setMarks(this.marks);
    this.scene.add(this.holo.root);
  }

  /** Operations in force (hologram marks). */
  setMarks(on: ReadonlySet<Op>): void {
    this.marks = new Set(on);
    this.holo?.setMarks(this.marks);
  }

  /** A decision: its thread runs sense organ → hologram path → legs. */
  decide(e: DecisionEvent): void {
    this.thread = { e, age: 0 };
  }

  /** A zoom is flying (input waits). */
  get zooming(): boolean {
    return this.zoom !== null;
  }

  /**
   * Dives into the fly's head from the current camera; `done` once the screen is black (the seam).
   * `at` freezes the flight there (snaps).
   */
  dive(done: () => void, at?: number): void {
    if (this.zoom) return;
    const target = this.controls.target.clone();
    const d = this.v.copy(this.camera.position).sub(target);
    const radius = d.length();
    const pose = { radius, azimuth: Math.atan2(d.x, d.z), elevation: Math.asin(d.y / radius) };
    this.start({ dir: 'in', age: at ?? 0, frozen: at !== undefined, dish: { pose, target }, done });
  }

  /** Flies out of the fly's head to the fitted framing (arrived from the brain view). */
  arrive(at?: number): void {
    const pose = { radius: this.fitted, azimuth: 0, elevation: (PITCH * Math.PI) / 180 };
    this.start({ dir: 'out', age: at ?? 0, frozen: at !== undefined, dish: { pose, target: new Vector3() } });
  }

  /** Advances the zoom by `dt` wall ms (the sim waits meanwhile): camera, hologram, veils. */
  flight(dt: number): void {
    const z = this.zoom;
    if (!z) return;
    if (!z.frozen) z.age += dt;
    const shot = zoomAt(z.age, z.dir, this.opts.reducedMotion);
    const head = this.fly.head();
    if (!this.opts.reducedMotion) {
      const half = (this.holo?.half ?? HALF_GUESS).map((v) => v * HoloView.scaleAt(1)) as Vec3;
      const brain: Shot = {
        pose: {
          radius: seamDistance(half, FOV, this.camera.aspect),
          azimuth: facing(this.holo?.facing ?? this.fly.root.rotation.y),
          elevation: 0,
        },
        target: head,
      };
      const target = new Vector3().lerpVectors(z.dish.target, brain.target, shot.k);
      this.camera.position.fromArray(posePosition(lerpPose(z.dish.pose, brain.pose, shot.k))).add(target);
      this.camera.lookAt(target);
      this.holo?.sink(shot.sink, head);
    }
    this.veilAlpha.value = shot.veil;
    this.veil.visible = shot.veil > 0;
    this.lit.value = 1 - shot.black;
    // a frozen dive holds at the seam (snaps); a frozen way out at its end lands like a live one
    if (!shot.done || (z.frozen && z.dir === 'in')) return;
    if (z.dir === 'in') {
      z.done?.();
      z.done = undefined;
      return;
    }
    this.zoom = null;
    this.controls.enabled = true;
    this.controls.target.set(0, 0, 0);
    this.holo?.sink(0, head);
  }

  private start(z: Zoom): void {
    this.zoom = z;
    this.controls.enabled = false;
    this.flight(0);
  }

  /** Wall-clock animation (`dt` ms; 0 while paused): hologram follow and node flashes, the thread. */
  animate(dt: number, heat: ReadonlyMap<string, number>): void {
    const f = this.fly.root;
    this.holo?.follow(f.position.x, f.position.z, f.rotation.y, dt);
    this.holo?.heat(heat);
    const th = this.thread;
    if (th) th.age = this.opts.still ? RUN_MS : th.age + dt;
    const look = th && this.holo ? threadAt(th.age, this.opts.reducedMotion) : null;
    this.threadLine.visible = this.head.visible = !!look;
    if (!th || !look || !this.holo) {
      if (!look) this.thread = null;
      return;
    }
    const { action, side, ms } = th.e;
    const hops = this.holo.path(action, side);
    // a sensed decision starts at the organ; forced cells (no sense) start at the command neuron
    const sensed = ms !== null;
    const from = sensed ? this.fly.organ(PATHS[action].organ, side) : hops.at(-1);
    const pts = [from, ...(sensed ? hops : []), this.fly.organ('legs', null)]
      .filter((p) => !!p)
      .map((p) => p.toArray() as Vec3);
    const line = cut(pts, look.drawn).slice(0, THREAD_MAX / 2 + 1);
    const a = this.threadPos.array as Float32Array;
    for (let i = 1; i < line.length; i++) {
      a.set(line[i - 1] as Vec3, (i - 1) * 6);
      a.set(line[i] as Vec3, (i - 1) * 6 + 3);
    }
    this.threadLine.geometry.setDrawRange(0, Math.max(0, line.length - 1) * 2);
    this.threadPos.needsUpdate = true;
    this.head.position.fromArray(line.at(-1) ?? [0, 0, 0]);
    this.threadAlpha.value = look.alpha;
  }

  /** The canvas (pointer input target). */
  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Where a client point falls on the floor (world mm, possibly off the dish); null above the horizon. */
  pick(cx: number, cy: number): Spot | null {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    this.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return floorHit(this.ray.ray.origin, this.ray.ray.direction);
  }

  /** A floor point in canvas px. */
  project(x: number, y: number): { x: number; y: number } {
    this.v.set(x, 0, -y).project(this.camera);
    const { clientWidth: w, clientHeight: h } = this.canvas;
    return { x: ((this.v.x + 1) / 2) * w, y: ((1 - this.v.y) / 2) * h };
  }

  /** The faint ring under the cursor, with a ghost of the item being placed; null hides both. */
  aim(p: Spot | null, kind: ItemKind | null = null): void {
    this.aimRing.visible = !!p;
    if (p) this.aimRing.position.set(p.x, 0.006, -p.y);
    if (this.ghost && (this.ghost.kind !== kind || !p)) {
      this.scene.remove(this.ghost.view.root);
      this.ghost = null;
    }
    if (!p || !kind) return;
    if (!this.ghost) {
      const view = itemView({ id: 0, kind, x: p.x, y: p.y, heading: 0 });
      view.root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.material = (m.material as { clone(): Mesh['material'] }).clone();
        (m.material as { opacity: number }).opacity = GHOST;
      });
      this.scene.add(view.root);
      this.ghost = { kind, view };
    }
    this.ghost.view.update(
      { id: 0, kind, x: p.x, y: p.y, heading: Math.PI / 2 },
      performance.now() / SLOW_GHOST,
    );
  }

  /** Forget the trail and the fly's flight (dish reset). */
  clear(): void {
    this.thread = null;
    this.trail.clear();
    this.lastTrail = null;
    this.fly.reset();
  }

  dispose(): void {
    this.disposed = true;
    this.resize.disconnect();
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.holo?.dispose();
    void Promise.resolve(this.initialized)
      .catch(() => {})
      .then(() => this.renderer.dispose());
    this.renderer.domElement.remove();
  }

  private pushTrail(t: number, x: number, y: number, a: Action): void {
    const last = this.lastTrail;
    if (last && last.a === a && Math.hypot(x - last.x, y - last.y) < TRAIL_STEP) return;
    this.trail.push(t, x, y, a);
    this.lastTrail = { x, y, a };
  }
  private ring(x: number, y: number, t: number): void {
    const mesh = new Mesh(this.ringGeo, glow(BONE, 1.6));
    mesh.position.set(x, 0.004, -y);
    this.scene.add(mesh);
    this.rings.push({ mesh, t });
  }

  /**
   * Centres the dish in the band the chrome leaves free (px covered on each side): the phone's
   * sheet grows per tab, so the picture glides up rather than hiding the fly; on desktop the dish
   * fits between the palette and the operations.
   */
  frameBand(band: Band): void {
    const b = this.band;
    // a px of resize jitter must not start a glide
    const same = (k: keyof Band) => Math.abs(band[k] - b[k]) < 2;
    if (same('top') && same('bottom') && same('left') && same('right')) return;
    this.band = band;
    this.fit();
  }

  private ease(dt: number): void {
    const { shift: s, shiftTo: to } = this;
    if (s.x === to.x && s.y === to.y) return;
    const k = Number.isFinite(dt) ? 1 - Math.exp(-Math.max(dt, 0) / LIFT_MS) : 1;
    s.x += (to.x - s.x) * k;
    s.y += (to.y - s.y) * k;
    if (Math.abs(to.x - s.x) < 0.5 && Math.abs(to.y - s.y) < 0.5) this.shift = { ...to };
    this.offset();
  }

  private offset(): void {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    const { x, y } = this.shift;
    if (x || y) this.camera.setViewOffset(w, h, x, y, w, h);
    else this.camera.clearViewOffset();
  }

  /** Sizes the canvas and frames the dish; the user's zoom range follows the fitted distance. */
  private fit(): void {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const f = frame(w, h, this.band, LENS);
    this.shiftTo = { x: f.x, y: f.y };
    if (this.opts.still || this.opts.reducedMotion) this.shift = { ...this.shiftTo };
    this.offset();
    const fit = f.dist;
    const pitch = (PITCH * Math.PI) / 180;
    this.controls.minDistance = fit * ZOOM_IN;
    this.controls.maxDistance = fit * ZOOM_OUT;
    if (!this.fitted) this.camera.position.set(0, fit * Math.sin(pitch), fit * Math.cos(pitch));
    // refit (columns measured, resize): keep the visitor's zoom as a share of the fitted distance
    else if (!this.zoom && fit !== this.fitted) this.camera.position.multiplyScalar(fit / this.fitted);
    this.fitted = fit;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
}

/** A hand's shadow on the floor: dark fill under a faint rim ring, radius in mm. */
function disc() {
  const root = new Group();
  const fill = new Mesh(new CircleGeometry(1, 64).rotateX(-Math.PI / 2), dark(0.6));
  const rim = new Mesh(new RingGeometry(0.96, 1, 64).rotateX(-Math.PI / 2), glow(BONE, 0.5));
  fill.position.y = 0.005;
  rim.position.y = 0.006;
  root.add(fill, rim);
  root.visible = false;
  return {
    root,
    show(s: { x: number; y: number; r: number } | null) {
      root.visible = !!s && s.r > 0;
      if (!s || s.r <= 0) return;
      root.position.set(s.x, 0, -s.y);
      root.scale.setScalar(s.r);
    },
  };
}
