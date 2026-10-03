import type { Manifest } from '@fly/data';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass } from 'three/tsl';
import {
  AgXToneMapping,
  Group,
  type Node,
  PerspectiveCamera,
  RenderPipeline,
  Scene,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import { frameDistance } from './frame';
import { sampleFrame } from './frameStats';
import { EASE_IN_OUT, type Pose, posePosition } from './intro';
import { orbitDistance } from './orbit';
import type { Preset } from './quality';

/** Breathing room around the CNS front face in the initial framing. */
const FRAME_MARGIN = 1.0;
/** Bloom picks up only the HDR spike fronts; the resting glow stays below the threshold. */
const BLOOM = { strength: 0.5, radius: 0.4, threshold: 1.0 };
/** Fly-to: duration and framing margin around the neuron's bounding sphere. */
const FLY_MS = 900;
const FLY_MARGIN = 1.6;

interface Flight {
  t0: number;
  ms: number;
  fromTarget: Vector3;
  toTarget: Vector3;
  fromDist: number;
  toDist: number;
  /** Unit vector target → camera, kept for the whole flight. */
  dir: Vector3;
}

export type Backend = 'webgpu' | 'webgl2';

export interface EngineOptions {
  /** Use the WebGL2 backend even when WebGPU is available (`?gl=webgl2`). */
  forceWebGL: boolean;
  reducedMotion: boolean;
}

/** Renderer, camera and frame loop. Owns its canvas inside `host`; React never touches it. */
export class Engine {
  readonly scene = new Scene();
  /** Content in source units goes here; `setFrame` maps the CNS bbox to centred µm, y up. */
  readonly world = new Group();
  readonly camera = new PerspectiveCamera(35, 1, 1, 1e4);
  readonly renderer: WebGPURenderer;
  disposed = false;
  /** Working framing set by `setFrame` (the intro dives to it). */
  restPose: Pose = { radius: 1, azimuth: 0, elevation: 0 };
  private readonly controls: OrbitControls;
  private readonly pipeline: RenderPipeline;
  private readonly plain: Node;
  private readonly bloomed: Node;
  private maxPixelRatio = 2;
  private readonly resize = new ResizeObserver(() => this.fit());
  private readonly hooks = new Set<(now: number) => void>();
  private initialized?: Promise<unknown>;
  private flight: Flight | null = null;
  private readonly reducedMotion: boolean;

  constructor(
    private readonly host: HTMLElement,
    opts: EngineOptions,
  ) {
    this.renderer = new WebGPURenderer({ antialias: false, forceWebGL: opts.forceWebGL });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio));
    this.renderer.setClearColor(0x000000, 1);
    // additive neuropils stack far above 1; roll off instead of clipping to white
    this.renderer.toneMapping = AgXToneMapping;
    this.renderer.domElement.className = 'block size-full outline-none';
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !opts.reducedMotion;
    this.reducedMotion = opts.reducedMotion;
    // the user takes over: drop a flight in progress
    this.controls.addEventListener('start', () => {
      this.flight = null;
    });
    this.scene.add(this.world);
    const scenePass = pass(this.scene, this.camera);
    const color = scenePass.getTextureNode('output');
    this.plain = color;
    this.bloomed = color.add(bloom(color, BLOOM.strength, BLOOM.radius, BLOOM.threshold));
    this.pipeline = new RenderPipeline(this.renderer, this.bloomed);
  }

  /** Pixel-ratio cap and bloom of a quality preset. MSAA stays off: it was the costliest thing (2.8). */
  applyQuality(p: Preset) {
    const out = p.bloom ? this.bloomed : this.plain;
    if (this.pipeline.outputNode !== out) {
      this.pipeline.outputNode = out;
      this.pipeline.needsUpdate = true;
    }
    if (p.pixelRatio !== this.maxPixelRatio) {
      this.maxPixelRatio = p.pixelRatio;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, p.pixelRatio));
      this.fit();
    }
  }

  async init(): Promise<Backend> {
    this.initialized = this.renderer.init();
    await this.initialized;
    if (!this.disposed) {
      this.fit();
      this.resize.observe(this.host);
      this.renderer.setAnimationLoop((now) => this.frame(now));
    }
    return this.backend;
  }

  get backend(): Backend {
    return (this.renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  }

  /**
   * Centre the bbox at the origin and scale source units to µm. EM y points down, so the world is
   * rotated 180° about x (y and z negated) — y up without mirroring. Frames the camera on the bbox.
   */
  setFrame(m: Manifest) {
    const s = m.unitNm / 1000;
    const min = new Vector3().fromArray(m.bbox.min);
    const max = new Vector3().fromArray(m.bbox.max);
    this.world.scale.set(s, -s, -s);
    this.world.position.copy(min).add(max).multiplyScalar(0.5).multiply(this.world.scale).negate();

    const half = max.sub(min).multiplyScalar(s / 2);
    const radius = half.length();
    const dist = frameDistance(half.toArray(), this.camera.fov, this.camera.aspect, FRAME_MARGIN);
    this.camera.near = dist / 100;
    this.camera.far = dist * 10;
    this.restPose = { radius: dist, azimuth: 0, elevation: 0 };
    this.setPose(this.restPose);
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = radius * 0.05;
    this.controls.maxDistance = dist * 3;
    this.controls.update();
  }

  /** Camera on its orbit around the origin (intro poses). */
  setPose(p: Pose) {
    this.camera.position.fromArray(posePosition(p));
    this.camera.lookAt(this.controls.target);
  }

  /**
   * Orbit around `center` (world) at a distance framing a sphere of `radius`, keeping the view
   * direction. Animated (strong ease-in-out) unless reduced motion or `instant`; user input cancels it.
   */
  flyTo(center: Vector3, radius: number, instant = false) {
    const toDist = Math.min(
      this.controls.maxDistance,
      Math.max(
        this.controls.minDistance,
        frameDistance([radius, radius, radius], this.camera.fov, this.camera.aspect, FLY_MARGIN),
      ),
    );
    const fromTarget = this.controls.target.clone();
    const offset = this.camera.position.clone().sub(fromTarget);
    const fromDist = offset.length();
    this.flight = {
      t0: performance.now(),
      ms: this.reducedMotion || instant ? 0 : FLY_MS,
      fromTarget,
      toTarget: center.clone(),
      fromDist,
      toDist,
      dir: offset.divideScalar(fromDist || 1),
    };
  }

  /** User starts orbiting / zooming; returns an unsubscribe. */
  onUserInput(fn: () => void): () => void {
    this.controls.addEventListener('start', fn);
    return () => this.controls.removeEventListener('start', fn);
  }

  /** Called every frame before render; returns an unsubscribe. */
  onFrame(fn: (now: number) => void): () => void {
    this.hooks.add(fn);
    return () => {
      this.hooks.delete(fn);
    };
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.controls.dispose();
    this.hooks.clear();
    this.pipeline.dispose();
    // Disposing mid-init (StrictMode double mount) would race the device request.
    void Promise.resolve(this.initialized)
      .catch(() => {})
      .then(() => this.renderer.dispose());
    this.renderer.domElement.remove();
  }

  private frame(now: number) {
    this.fly(now);
    this.controls.update();
    orbitDistance.value = this.camera.position.distanceTo(this.controls.target);
    for (const fn of this.hooks) fn(now);
    const t0 = performance.now();
    this.pipeline.render();
    sampleFrame(now, performance.now() - t0);
  }

  private fly(now: number) {
    const f = this.flight;
    if (!f) return;
    const k = f.ms > 0 ? Math.min(1, (now - f.t0) / f.ms) : 1;
    const e = EASE_IN_OUT(k);
    this.controls.target.lerpVectors(f.fromTarget, f.toTarget, e);
    const d = f.fromDist + (f.toDist - f.fromDist) * e;
    this.camera.position.copy(f.dir).multiplyScalar(d).add(this.controls.target);
    if (k >= 1) this.flight = null;
  }

  private fit() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
