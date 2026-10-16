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

/** The share of the polyline's arc length up to point `i` (0 for a zero-length line). */
export function shareTo(points: readonly Vec3[], i: number): number {
  let to = 0;
  let all = 0;
  for (let k = 1; k < points.length; k++) {
    const l = dist(points[k - 1] as Vec3, points[k] as Vec3);
    all += l;
    if (k <= i) to += l;
  }
  return all ? to / all : 0;
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Decision flash on the hologram's rim: its gain × this at the peak, reached and left (wall ms). */
export const FLARE_PEAK = 4;
const FLARE_IN = 100;
const FLARE_OUT = 500;

/** Rim gain factor at `ms` wall time since the decision (1 = rest). */
export function flareAt(ms: number, reducedMotion: boolean): number {
  if (reducedMotion || ms < 0 || ms >= FLARE_IN + FLARE_OUT) return 1;
  const k = ms < FLARE_IN ? ms / FLARE_IN : (1 - (ms - FLARE_IN) / FLARE_OUT) ** 2;
  return 1 + (FLARE_PEAK - 1) * k;
}

/** Replay: after the decision the thread holds, then fades, sim ms (the clip's tail). */
export const REPLAY_HOLD = 120;
export const REPLAY_FADE = 80;

/**
 * Thread look in a replay at sim time `t`: the pulse leaves the sense organ at the onset and
 * reaches the legs at the decision (the real latency); forced cells draw it whole at the decision.
 */
export function threadReplay(
  t: number,
  e: { t: number; ms: number | null },
  reducedMotion: boolean,
): { drawn: number; alpha: number } | null {
  const from = e.t - (e.ms ?? 0);
  const after = t - e.t;
  if (t < from || after >= REPLAY_HOLD + REPLAY_FADE) return null;
  const drawn = reducedMotion || !e.ms ? 1 : Math.min(1, (t - from) / e.ms);
  const alpha = after <= REPLAY_HOLD ? 1 : 1 - (after - REPLAY_HOLD) / REPLAY_FADE;
  return { drawn, alpha };
}
