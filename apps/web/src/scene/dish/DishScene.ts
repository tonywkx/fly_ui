import { type Action, ARENA_R, SWAT_MS, SWAT_R, type World, type WorldEvent } from '@fly/sim';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass } from 'three/tsl';
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
  type Node,
  PerspectiveCamera,
  RenderPipeline,
  RingGeometry,
  Scene,
  WebGPURenderer,
} from 'three/webgpu';
import type { Backend } from '../engine';
import type { Preset } from '../quality';
import { arena } from './arena';
import { FlyView } from './fly';
import { type ItemView, itemView } from './items';
import { BONE, dark, glow } from './materials';
import { Trail } from './trail';

const FOV = 30;
/** Start pitch and its clamp (deg above the floor). */
const PITCH = 40;
const PITCH_MIN = 25;
const PITCH_MAX = 60;
/** Share of the viewport the dish fills: its (foreshortened) height on desktop, its width on phones. */
const FILL_H = 0.6;
const FILL_W = 0.92;
/** Zoom range as distance factors of the fitted one (fly ≈ 200 … 60 px around ≈ 90). */
const ZOOM_IN = 0.45;
const ZOOM_OUT = 1.5;
const BLOOM = { strength: 0.45, radius: 0.15, threshold: 1.0 };
/** Trail points closer than this (mm) are merged. */
const TRAIL_STEP = 0.03;
/** Takeoff ring: life (sim ms) and final radius (mm). */
const RING_MS = 600;
const RING_R = 1.6;

export interface DishSceneOptions {
  forceWebGL: boolean;
  reducedMotion: boolean;
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
  private lastTrail: { x: number; y: number; a: Action } | null = null;
  private fitted = 0;
  private disposed = false;
  private initialized: Promise<unknown> | null = null;

  constructor(
    private readonly host: HTMLElement,
    opts: DishSceneOptions,
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
    );

    const scenePass = pass(this.scene, this.camera, { samples: 4 });
    const color = scenePass.getTextureNode('output');
    this.plain = color;
    this.bloomed = color.add(bloom(color, BLOOM.strength, BLOOM.radius, BLOOM.threshold));
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
      this.controls.update();
      this.pipeline.render();
    });
  }

  /** Mirrors the world at sim time `t` (after `events` happened on the way there). */
  sync(world: World, action: Action, t: number, events: readonly WorldEvent[]): void {
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
    this.fly.update(f, action, t, f.down > 0);

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

  /** Forget the trail and takeoff rings (dish reset). */
  clear(): void {
    this.trail.clear();
    this.lastTrail = null;
  }

  dispose(): void {
    this.disposed = true;
    this.resize.disconnect();
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
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

  /** Sizes the canvas and frames the dish; the user's zoom range follows the fitted distance. */
  private fit(): void {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const tan = Math.tan((FOV * Math.PI) / 360);
    const pitch = (PITCH * Math.PI) / 180;
    const d = 2 * ARENA_R;
    const fit = Math.max(
      (d * Math.sin(pitch)) / FILL_H / (2 * tan),
      d / FILL_W / (2 * tan * this.camera.aspect),
    );
    this.controls.minDistance = fit * ZOOM_IN;
    this.controls.maxDistance = fit * ZOOM_OUT;
    if (!this.fitted) this.camera.position.set(0, fit * Math.sin(pitch), fit * Math.cos(pitch));
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
