import type { Manifest } from '@fly/data';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Group, PerspectiveCamera, Scene, Vector3, WebGPURenderer } from 'three/webgpu';
import { frameDistance } from './frame';
import { sampleFrame } from './frameStats';

/** Breathing room around the CNS front face in the initial framing. */
const FRAME_MARGIN = 1.0;

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
  private readonly controls: OrbitControls;
  private readonly resize = new ResizeObserver(() => this.fit());
  private readonly hooks = new Set<(now: number) => void>();
  private initialized?: Promise<unknown>;

  constructor(
    private readonly host: HTMLElement,
    opts: EngineOptions,
  ) {
    this.renderer = new WebGPURenderer({ antialias: true, forceWebGL: opts.forceWebGL });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.domElement.className = 'block size-full outline-none';
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !opts.reducedMotion;
    this.scene.add(this.world);
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
    this.camera.position.set(0, 0, dist);
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = radius * 0.05;
    this.controls.maxDistance = dist * 3;
    this.controls.update();
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
    // Disposing mid-init (StrictMode double mount) would race the device request.
    void Promise.resolve(this.initialized)
      .catch(() => {})
      .then(() => this.renderer.dispose());
    this.renderer.domElement.remove();
  }

  private frame(now: number) {
    this.controls.update();
    for (const fn of this.hooks) fn(now);
    const t0 = performance.now();
    this.renderer.render(this.scene, this.camera);
    sampleFrame(now, performance.now() - t0);
  }

  private fit() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
