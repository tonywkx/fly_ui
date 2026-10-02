import type { SpikeTrain } from '@fly/data';

/** "Last spike" of a row that has not fired: far enough in the past that every glow has decayed. */
export const NEVER = -1e9;
/** Longest real frame gap the playback clock honours (a hidden tab must not jump the sim). */
const MAX_FRAME_MS = 100;

/**
 * Ring buffer of time-ordered spike events (sim ms, scenario row) between a producer (baked train or
 * the live sim Worker) and the frame loop. `until` = sim time up to which the stream is complete.
 */
export class SpikeFeed {
  until = 0;
  private t: Float32Array;
  private row: Uint32Array;
  private head = 0;
  private len = 0;

  constructor(capacity = 4096) {
    this.t = new Float32Array(capacity);
    this.row = new Uint32Array(capacity);
  }

  get pending(): number {
    return this.len;
  }

  /** Appends events (times ≥ every queued one) and moves the horizon to `until`. */
  push(t: ArrayLike<number>, row: ArrayLike<number>, until: number): void {
    const m = t.length;
    if (this.len + m > this.t.length) this.grow(this.len + m);
    const cap = this.t.length;
    for (let k = 0; k < m; k++) {
      const j = (this.head + this.len + k) % cap;
      this.t[j] = t[k] as number;
      this.row[j] = row[k] as number;
    }
    this.len += m;
    this.until = until;
  }

  /** Pops every event with time ≤ `upTo` into `lastSpike[row]`; true if anything was written. */
  drain(upTo: number, lastSpike: Float32Array): boolean {
    const cap = this.t.length;
    let n = 0;
    while (n < this.len) {
      const j = (this.head + n) % cap;
      const t = this.t[j] as number;
      if (t > upTo) break;
      lastSpike[this.row[j] as number] = t;
      n++;
    }
    this.head = (this.head + n) % cap;
    this.len -= n;
    return n > 0;
  }

  reset(): void {
    this.head = 0;
    this.len = 0;
    this.until = 0;
  }

  private grow(need: number): void {
    let cap = this.t.length * 2;
    while (cap < need) cap *= 2;
    const t = new Float32Array(cap);
    const row = new Uint32Array(cap);
    for (let k = 0; k < this.len; k++) {
      const j = (this.head + k) % this.t.length;
      t[k] = this.t[j] as number;
      row[k] = this.row[j] as number;
    }
    this.t = t;
    this.row = row;
    this.head = 0;
  }
}

/** A baked train as feed events: spike at step s = bin·spb + sub → t = s·dt; bins are (sub, row) sorted. */
export function bakedEvents(train: SpikeTrain): { t: Float32Array; row: Uint32Array; until: number } {
  const spb = Math.round(train.binMs / train.dt);
  const t = new Float32Array(train.ids.length);
  for (let b = 0; b + 1 < train.offsets.length; b++)
    for (let k = train.offsets[b] as number; k < (train.offsets[b + 1] as number); k++)
      t[k] = (b * spb + (train.sub[k] as number)) * train.dt;
  return { t, row: Uint32Array.from(train.ids), until: train.durationMs };
}

/** Playback clock: `rate` sim ms per real second, capped at the data horizon `until`. */
export function nextSimTime(prev: number, frameMs: number, rate: number, until: number): number {
  return Math.min(prev + (Math.min(frameMs, MAX_FRAME_MS) * rate) / 1000, until);
}
