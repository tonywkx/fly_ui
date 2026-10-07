import type { Action } from '@fly/sim';
import { EASE_IN_OUT, EASE_OUT } from '../intro';

/**
 * «From fly to neuron» (pure): the camera dives from the dish framing to the front of the fly's
 * head while the hologram sinks into it; the dish is veiled, then black — the seam where the page
 * becomes the brain view, whose intro starts from the same dust. `out` is the way back, mirrored.
 */

/** The whole flight, wall ms. */
export const ZOOM_MS = 1600;
/** Reduced motion: a plain fade through black, no travel. */
export const FADE_MS = 300;
/** Shares of the flight: the dish fades over `veil`, the hologram to black over `black`. */
const VEIL = [0.3, 0.75] as const;
const BLACK = [0.85, 1] as const;

export type ZoomDir = 'in' | 'out';

export interface ZoomShot {
  /** Camera travel: 0 = dish framing, 1 = in front of the brain. */
  k: number;
  /** Dish, fly and items veiled (the hologram stays), 0..1. */
  veil: number;
  /** Everything black, 0..1. */
  black: number;
  done: boolean;
}

/** The flight `ms` wall ms after it began. */
export function zoomAt(ms: number, dir: ZoomDir, reduced: boolean): ZoomShot {
  const len = reduced ? FADE_MS : ZOOM_MS;
  const done = ms >= len;
  const t = clamp01((dir === 'in' ? ms : len - ms) / len);
  if (reduced) {
    const b = EASE_OUT(t);
    return { k: 0, veil: b, black: b, done };
  }
  return { k: EASE_IN_OUT(t), veil: EASE_IN_OUT(span(t, VEIL)), black: span(t, BLACK), done };
}

/** Camera azimuth (about +y from +z, as `intro.ts` `Pose`) in front of a fly with world `heading`. */
export function facing(heading: number): number {
  // world (cos h, sin h) is scene (cos h, 0, −sin h) = (sin a, ·, cos a)
  return heading + Math.PI / 2;
}

/** The brain view's scenario for the fly's last decision (escape when she has not decided yet). */
export function scenarioFor(a: Action | null): string {
  if (a === 'eat') return 'sugar';
  if (a === 'court') return 'song';
  return 'escape';
}

function span(t: number, [a, b]: readonly [number, number]): number {
  return clamp01((t - a) / (b - a));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
