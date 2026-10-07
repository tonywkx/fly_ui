import type { Action } from '@fly/sim';

// The fly's light trail on the dish floor: a ring of timed points, drawn as line segments whose
// colour names the action and fades with age (additive, so dimming = darker rgb).

export const FADE_MS = 4000;

/** Linear rgb per action at full strength (TERRARIUM-SHAPE §World: walk bone 30 %, eat saffron, back blue, court magenta). */
export const TRAIL_RGB: Record<Action, readonly [number, number, number]> = {
  walk: [0.3, 0.3, 0.3],
  eat: [1, 0.48, 0.02],
  back: [0.08, 0.26, 1],
  court: [1, 0.03, 0.45],
  jump: [0, 0, 0],
};

export class Trail {
  private readonly t: Float64Array;
  private readonly xy: Float32Array;
  private readonly act: Action[];
  /** Point i starts a new line (not joined to the one before). */
  private readonly brk: Uint8Array;
  private head = 0;
  private size = 0;
  private broken = true;

  constructor(readonly capacity = 4096) {
    this.t = new Float64Array(capacity);
    this.xy = new Float32Array(capacity * 2);
    this.act = new Array<Action>(capacity).fill('walk');
    this.brk = new Uint8Array(capacity);
  }

  /** Adds a point at world mm `x, y`, sim time `t`. */
  push(t: number, x: number, y: number, a: Action): void {
    const i = this.head;
    this.t[i] = t;
    this.xy[2 * i] = x;
    this.xy[2 * i + 1] = y;
    this.act[i] = a;
    this.brk[i] = this.broken ? 1 : 0;
    this.broken = false;
    this.head = (i + 1) % this.capacity;
    this.size = Math.min(this.size + 1, this.capacity);
  }

  /** The next point starts a new line (takeoff, shattering, reset). */
  gap(): void {
    this.broken = true;
  }

  clear(): void {
    this.size = 0;
    this.broken = true;
  }

  /** Writes live segments (scene xyz pairs, rgb pairs) oldest first; returns the count. */
  fill(now: number, pos: Float32Array, rgb: Float32Array): number {
    let n = 0;
    const first = (this.head - this.size + this.capacity) % this.capacity;
    for (let k = 1; k < this.size; k++) {
      const i = (first + k) % this.capacity;
      const j = (i - 1 + this.capacity) % this.capacity;
      if (this.brk[i] || now - (this.t[j] as number) >= FADE_MS) continue;
      const c = TRAIL_RGB[this.act[i] as Action];
      const o = n * 6;
      for (const [s, p] of [
        [0, j],
        [3, i],
      ] as const) {
        const f = Math.max(0, 1 - (now - (this.t[p] as number)) / FADE_MS);
        pos[o + s] = this.xy[2 * p] as number;
        pos[o + s + 1] = 0;
        pos[o + s + 2] = -(this.xy[2 * p + 1] as number);
        rgb[o + s] = c[0] * f;
        rgb[o + s + 1] = c[1] * f;
        rgb[o + s + 2] = c[2] * f;
      }
      n++;
    }
    return n;
  }
}
