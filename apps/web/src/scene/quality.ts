import type { Backend } from './engine';

export const QUALITIES = ['low', 'med', 'high'] as const;
export type Quality = (typeof QUALITIES)[number];

export interface Preset {
  /** How many `cloud-lod{i}` tiers of background dust to show (lod0 always first). */
  dustTiers: number;
  /** Cap on `devicePixelRatio`. */
  pixelRatio: number;
  bloom: boolean;
  /** Backdrop blur behind HUD panels (CSS re-filters the live canvas every frame). */
  blur: boolean;
}

/**
 * Measured on M4 at 1600×1000 css px (`pnpm perf`): MSAA costs most and is off everywhere; dust past
 * lod0 halves the frame rate whatever the pixel ratio (primitive-bound), so every preset keeps lod0. high at pr 2 dips to 54 fps, 1.75 holds 60.
 * 6.1 (same rig): escape holds 60 on every preset and both backends; song (1.7k neurons) is GPU-bound —
 * high 48 / med 52 / low 60 on WebGPU, low on WebGL2 51 → 60 once panel backdrop blur is off.
 */
export const QUALITY: Record<Quality, Preset> = {
  low: { dustTiers: 1, pixelRatio: 1, bloom: false, blur: false },
  med: { dustTiers: 1, pixelRatio: 1.5, bloom: true, blur: true },
  high: { dustTiers: 1, pixelRatio: 1.75, bloom: true, blur: true },
};

export const isQuality = (v: unknown): v is Quality => (QUALITIES as readonly unknown[]).includes(v);

export function downgrade(q: Quality): Quality {
  return QUALITIES[Math.max(0, QUALITIES.indexOf(q) - 1)] ?? 'low';
}

export interface Device {
  backend: Backend;
  /** `(pointer: coarse)` — phones/tablets. */
  coarsePointer: boolean;
  /** `navigator.hardwareConcurrency`. */
  cores: number;
}

/** Starting preset when the URL does not pick one. */
export function defaultQuality(d: Device): Quality {
  if (d.coarsePointer || d.cores <= 4) return 'low';
  return d.backend === 'webgl2' ? 'med' : 'high';
}

/**
 * fps below this for `SLOW_WINDOWS` consecutive frame-stat windows (500 ms each) → step down.
 * ~50 fps on a 60 Hz display is every 5th frame doubled: visible judder (song at high, `pnpm perf`).
 */
const SLOW_FPS = 54;
const SLOW_WINDOWS = 3;

/** Steps the preset down while frames stay slow; feed it every `onFrameSample` window. */
export class FpsGuard {
  private slow = 0;

  /** Returns the preset to switch to, or undefined to keep `current`. */
  sample(fps: number, current: Quality): Quality | undefined {
    if (current === 'low') return;
    this.slow = fps < SLOW_FPS ? this.slow + 1 : 0;
    if (this.slow < SLOW_WINDOWS) return;
    this.slow = 0;
    return downgrade(current);
  }
}
