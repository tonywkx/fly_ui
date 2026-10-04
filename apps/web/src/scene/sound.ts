import type { SpikeLog } from '@/sim/feed';

/** A click to play `dt` real seconds after the frame's start, at `gain` (0…1). */
export interface Click {
  dt: number;
  gain: number;
}

export interface ClickOptions {
  /** Most clicks per frame; denser volleys are thinned evenly, each click louder. */
  max: number;
  /** Only these rows (the electrodes: the rig's audio monitor). Absent: every row. */
  rows?: readonly number[];
}

/** Gain of a lone spike's click; a thinned click standing for `k` spikes gets `BASE·√k`. */
const BASE = 0.35;
/** Longest real frame (s) the playback clock advances by (feed.ts MAX_FRAME_MS) plus slack. */
const MAX_STEP_S = 0.12;

/**
 * The spikes of (t0, t1] as clicks. `rate` = sim ms per real second, so a slowed clock spreads
 * them out as it does on screen.
 */
export function clicks(log: SpikeLog, t0: number, t1: number, rate: number, o: ClickOptions): Click[] {
  if (!(t1 > t0) || rate <= 0) return [];
  const [i0, i1] = log.span(t0, t1);
  const times = log.times;
  const rows = log.rows;
  const keep = o.rows ? new Set(o.rows) : null;
  const at: number[] = [];
  for (let i = i0; i < i1; i++) {
    if (keep && !keep.has(rows[i] as number)) continue;
    at.push(times[i] as number);
  }
  const n = at.length;
  if (!n) return [];
  const m = Math.min(n, o.max);
  const gain = Math.min(1, BASE * Math.sqrt(n / m));
  const out: Click[] = [];
  for (let j = 0; j < m; j++) {
    const t = at[Math.floor(((j + 0.5) * n) / m)] as number;
    out.push({ dt: (t - t0) / rate, gain });
  }
  return out;
}

/** True if `prev → t` is a play step (not a pause, a seek or a loop wrap): only then it sounds. */
export function continuous(prev: number, t: number, rate: number): boolean {
  return t > prev && t - prev <= rate * MAX_STEP_S;
}
