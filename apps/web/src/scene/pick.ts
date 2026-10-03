import {
  Group,
  Matrix4,
  type Mesh,
  NearestFilter,
  RenderTarget,
  Scene,
  UnsignedByteType,
  Vector2,
} from 'three/webgpu';
import type { Engine } from './engine';

/** Square read window around the pointer (physical px, odd): ribbons can be 1.5 px thin. */
const WINDOW = 9;

/** RGBA8 pixels → ids (`r + g·256 + b·65536`, as `layers/neurons` packs them). */
export function decodeIds(rgba: ArrayLike<number>): Uint32Array {
  const out = new Uint32Array(rgba.length >> 2);
  for (let i = 0; i < out.length; i++) {
    const o = i * 4;
    out[i] = (rgba[o] as number) | ((rgba[o + 1] as number) << 8) | ((rgba[o + 2] as number) << 16);
  }
  return out;
}

/**
 * Row under the window centre: the id (`row + 1`, 0 = empty) of the non-empty pixel closest to
 * (cx, cy); ties go to the first in scan order. Null if the window is empty.
 */
export function nearestHit(
  buf: ArrayLike<number>,
  w: number,
  h: number,
  cx = (w - 1) / 2,
  cy = (h - 1) / 2,
): number | null {
  let best: number | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const id = Math.round(buf[y * w + x] as number);
      if (id <= 0) continue;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = id - 1;
      }
    }
  }
  return best;
}

/**
 * GPU picking: renders `mesh` (writing `row + 1` packed into rgb) into an RGBA8 id target the size of the drawing
 * buffer and reads back a small window around the pointer. Re-renders only when the pointer or the
 * camera moved; one readback in flight at a time.
 */
export class Picker {
  // RGBA8: the one format WebGL2 reads back everywhere (RED/FLOAT readPixels is optional)
  private readonly rt = new RenderTarget(1, 1, {
    type: UnsignedByteType,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: true,
  });
  private readonly scene = new Scene();
  private readonly root = new Group();
  private readonly size = new Vector2();
  private readonly lastView = new Matrix4();
  private readonly lastProj = new Matrix4();
  /** Pointer in CSS px relative to the canvas, null when off it / dragging. */
  private pointer: [number, number] | null = null;
  private dirty = false;
  private busy = false;
  private disposed = false;

  constructor(
    private readonly engine: Engine,
    mesh: Mesh,
    private readonly onHit: (row: number | null) => void,
  ) {
    this.root.matrixAutoUpdate = false;
    this.root.add(mesh);
    this.scene.add(this.root);
  }

  /** Pointer position in CSS px relative to the canvas; null clears the hit. */
  setPointer(p: [number, number] | null) {
    this.pointer = p;
    this.dirty = true;
    if (!p) this.onHit(null);
  }

  /** Call once per frame (before render). */
  update() {
    if (this.busy || !this.pointer) return;
    const { camera, renderer } = this.engine;
    const size = renderer.getDrawingBufferSize(this.size);
    const moved =
      !this.lastView.equals(camera.matrixWorldInverse) || !this.lastProj.equals(camera.projectionMatrix);
    if (!this.dirty && !moved && size.x === this.rt.width && size.y === this.rt.height) return;
    this.dirty = false;
    this.lastView.copy(camera.matrixWorldInverse);
    this.lastProj.copy(camera.projectionMatrix);
    if (size.x !== this.rt.width || size.y !== this.rt.height) this.rt.setSize(size.x, size.y);

    this.engine.world.updateMatrixWorld();
    this.root.matrix.copy(this.engine.world.matrixWorld);
    this.root.matrixWorldNeedsUpdate = true;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rt);
    renderer.render(this.scene, camera);
    renderer.setRenderTarget(prev);

    // CSS px → physical px, window clamped into the target
    const canvas = renderer.domElement;
    const sx = size.x / canvas.clientWidth;
    const sy = size.y / canvas.clientHeight;
    const px = Math.floor(this.pointer[0] * sx);
    const py = Math.floor(this.pointer[1] * sy);
    const half = (WINDOW - 1) / 2;
    const x0 = Math.max(0, Math.min(size.x - WINDOW, px - half));
    const y0 = Math.max(0, Math.min(size.y - WINDOW, py - half));
    const w = Math.min(WINDOW, size.x);
    const h = Math.min(WINDOW, size.y);
    // WebGL reads bottom-up: flip the window and its rows
    const gl = this.engine.backend === 'webgl2';
    const readY = gl ? size.y - y0 - h : y0;
    const cx = px - x0;
    const cy = gl ? h - 1 - (py - y0) : py - y0;

    this.busy = true;
    renderer
      .readRenderTargetPixelsAsync(this.rt, x0, readY, w, h)
      .then((buf) => {
        if (this.disposed || !this.pointer) return;
        this.onHit(nearestHit(decodeIds(buf as Uint8Array), w, h, cx, cy));
      })
      .catch((e) => console.warn('[pick]', e))
      .finally(() => {
        this.busy = false;
      });
  }

  dispose() {
    this.disposed = true;
    this.rt.dispose();
  }
}
