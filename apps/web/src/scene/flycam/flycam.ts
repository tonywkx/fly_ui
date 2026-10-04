import { NoToneMapping, PerspectiveCamera, Scene, WebGPURenderer } from 'three/webgpu';
import type { FlyPose } from '../behavior';
import { FlyModel } from './model';

/** Three-quarter front view from the camera side, a little above. */
const EYE = [1.4, 3.4, 4.6] as const;
const LOOK = [-0.15, 0.8, 0] as const;
const FOV = 30;

/**
 * The behaviour camera: a small canvas of its own showing the glass fly. WebGL2 on purpose — a
 * second WebGPU device for a few hundred triangles is not worth it, and it keeps that path used.
 */
export class FlyCam {
  private readonly renderer: WebGPURenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  private readonly fly = new FlyModel();
  private ready: Promise<void> | null = null;
  private w = 0;
  private h = 0;

  /** Appends its own canvas to `host` (removed on dispose: a canvas never outlives its renderer). */
  constructor(private readonly host: HTMLElement) {
    this.renderer = new WebGPURenderer({ antialias: true, alpha: true, forceWebGL: true });
    this.renderer.domElement.className = 'block size-full';
    host.appendChild(this.renderer.domElement);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = NoToneMapping;
    this.camera.position.set(...EYE);
    this.camera.lookAt(...LOOK);
    this.scene.add(this.fly.root);
  }

  init(): Promise<void> {
    this.ready ??= this.renderer.init().then(() => {});
    return this.ready;
  }

  /** Draws `pose` at the host's CSS size. */
  render(pose: FlyPose): void {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    if (w !== this.w || h !== this.h) {
      this.w = w;
      this.h = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.fly.pose(pose);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    void Promise.resolve(this.ready)
      .catch(() => {})
      .then(() => this.renderer.dispose());
    this.renderer.domElement.remove();
  }
}
