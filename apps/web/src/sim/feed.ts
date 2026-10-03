import type { SpikeTrain } from '@fly/data';

/** "Last spike" of a row that has not fired: far enough in the past that every glow has decayed. */
export const NEVER = -1e9;
/** Longest real frame gap the playback clock honours (a hidden tab must not jump the sim). */
const MAX_FRAME_MS = 100;

/**
 * Spikes older than this (sim ms) have faded from the scene: a seek replays only this much history.
 * Afterglow is 40 ms; the wave front still travels a long neurite for a while after its spike.
 */
export const LOOKBACK_MS = 300;

/**
 * Time-ordered spike events (sim ms, scenario row) from a producer (baked train or the live sim
 * Worker), kept so the display clock can move both ways: play applies (prev, t], a seek rebuilds
 * `lastSpike` from the look-back window. `until` = sim time up to which the stream is complete;
 * `start` = earliest time still held (live history is trimmed).
 */
export class SpikeLog {
  until = 0;
  start = 0;
  private t: Float32Array;
  private row: Uint32Array;
  private head = 0;
  private end = 0;

  constructor(capacity = 4096) {
    this.t = new Float32Array(capacity);
    this.row = new Uint32Array(capacity);
  }

  get size(): number {
    return this.end - this.head;
  }

  /** Event times / rows; index with `span`. Valid until the next `push`. */
  get times(): Float32Array {
    return this.t;
  }

  get rows(): Uint32Array {
    return this.row;
  }

  /** Appends events (times ≥ every held one) and moves the horizon to `until`. */
  push(t: ArrayLike<number>, row: ArrayLike<number>, until: number): void {
    const m = t.length;
    if (this.end + m > this.t.length) this.make(this.size + m);
    for (let k = 0; k < m; k++) {
      this.t[this.end] = t[k] as number;
      this.row[this.end++] = row[k] as number;
    }
    this.until = until;
  }

  /** Index range [i0, i1) of the events with from < time ≤ to. */
  span(from: number, to: number): [number, number] {
    return [this.after(from), this.after(to)];
  }

  /** Writes the events of (from, to] into `lastSpike[row]`; true if anything was written. */
  apply(from: number, to: number, lastSpike: Float32Array): boolean {
    const [i0, i1] = this.span(from, to);
    for (let i = i0; i < i1; i++) lastSpike[this.row[i] as number] = this.t[i] as number;
    return i1 > i0;
  }

  /** `lastSpike` as it stands at time `t`, from scratch. */
  seek(t: number, lastSpike: Float32Array): void {
    lastSpike.fill(NEVER);
    this.apply(t - LOOKBACK_MS, t, lastSpike);
  }

  /** Drops the events before `time`. */
  trim(time: number): void {
    if (time <= this.start) return;
    let lo = this.head;
    let hi = this.end;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((this.t[mid] as number) < time) lo = mid + 1;
      else hi = mid;
    }
    this.head = lo;
    this.start = time;
  }

  reset(): void {
    this.head = 0;
    this.end = 0;
    this.until = 0;
    this.start = 0;
  }

  /** First index with time > x. */
  private after(x: number): number {
    let lo = this.head;
    let hi = this.end;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((this.t[mid] as number) <= x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Moves the held events to index 0, growing (doubling) to fit `need`. */
  private make(need: number): void {
    let cap = this.t.length;
    while (cap < need) cap *= 2;
    const n = this.size;
    if (cap === this.t.length) {
      this.t.copyWithin(0, this.head, this.end);
      this.row.copyWithin(0, this.head, this.end);
    } else {
      const t = new Float32Array(cap);
      const row = new Uint32Array(cap);
      t.set(this.t.subarray(this.head, this.end));
      row.set(this.row.subarray(this.head, this.end));
      this.t = t;
      this.row = row;
    }
    this.head = 0;
    this.end = n;
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
