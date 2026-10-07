import type { Vec3 } from './hologram';

/** Pulse travel from the sense organ to the legs, then how long the drawn thread holds and fades (wall ms). */
export const RUN_MS = 600;
export const HOLD_MS = 500;
export const FADE_MS = 700;

/** Thread look at `ms` wall time since the decision: how far it is drawn (0..1) and its opacity. */
export function threadAt(ms: number, reducedMotion: boolean): { drawn: number; alpha: number } | null {
  const run = reducedMotion ? 0 : RUN_MS;
  if (ms < 0 || ms >= run + HOLD_MS + FADE_MS) return null;
  const drawn = run ? Math.min(1, ms / run) : 1;
  const alpha = ms <= run + HOLD_MS ? 1 : 1 - (ms - run - HOLD_MS) / FADE_MS;
  return { drawn, alpha };
}

/** The polyline cut at `share` of its arc length; the last point is the pulse head. */
export function cut(points: readonly Vec3[], share: number): Vec3[] {
  const first = points[0];
  if (!first) return [];
  const seg = points.slice(1).map((p, i) => dist(points[i] as Vec3, p));
  let left = Math.max(0, Math.min(1, share)) * seg.reduce((a, b) => a + b, 0);
  const out: Vec3[] = [[...first]];
  for (let i = 0; i < seg.length; i++) {
    const a = points[i] as Vec3;
    const b = points[i + 1] as Vec3;
    const l = seg[i] as number;
    if (left >= l) {
      out.push([...b]);
      left -= l;
      continue;
    }
    const k = l ? left / l : 0;
    out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
    break;
  }
  return out;
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
