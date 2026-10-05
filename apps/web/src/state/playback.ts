import { makeAutoObservable, observableRef } from 'mobx';
import type { SpikeLog } from '@/sim/feed';
import { hotkey } from '../lib/keys';

/** Base playback speed: sim ms per real second at 1×. */
export const SIM_MS_PER_S = 40;
/** Speed multipliers, fastest first (slow-mo down to ⅛×). */
export const SPEEDS = [1, 0.5, 0.25, 0.125] as const;
/** One `,` / `.` step, sim ms. */
export const STEP_MS = 1;

/** Play-once after its story broke (a beat missed): at least 1× to the end, nothing more happens. */
export const onceRate = (rate: number, broken: boolean) => (broken ? Math.max(rate, SIM_MS_PER_S) : rate);

/** The story's last beat in a play-once run: when (sim ms), or when it was due and missed. */
export interface LastBeat {
  at: number;
  missed: boolean;
}

export type PlaybackAction = 'toggle' | 'back' | 'forward' | 'slower' | 'faster';

/**
 * Display clock controls: pause, speed, seeks. The shown time itself is written by the scene every
 * frame into `clock` (plain, not observable — no reactions per frame); seeks go the other way
 * through `seek` / `takeSeek`.
 */
export class PlaybackStore {
  paused = false;
  speed: number = SPEEDS[0];
  /** Activity source: the baked loop, or the live sim (endless, scrubbable within its history). */
  mode: 'baked' | 'live' = 'baked';
  /** Spikes being played (the raster draws them); swapped when live takes over. */
  log: SpikeLog | null = null;
  /** Shown sim time and the seekable range [start, end] (baked: the loop; live: held history). */
  readonly clock = { t: 0, start: 0, end: 0 };
  /** Play the run once and stop at its end (the tour) instead of looping / running on. */
  once = false;
  /** The play-once run reached its end (set by the scene, once per run). */
  ended = false;
  /** How the ended run's story ended (null: it has no story / did not get that far). */
  last: LastBeat | null = null;
  /** Latest restart-from-0 request (the scene reacts to a new object); `baked` leaves the live sim. */
  restartReq: { baked: boolean } | null = null;
  private pending: number | null = null;

  constructor() {
    makeAutoObservable<this, 'pending'>(this, {
      clock: false,
      pending: false,
      takeSeek: false,
      setRange: false,
      log: observableRef,
      restartReq: observableRef,
    });
  }

  get rate() {
    return SIM_MS_PER_S * this.speed;
  }

  toggle() {
    if (this.ended) this.restart();
    else this.paused = !this.paused;
  }

  setOnce(v: boolean) {
    this.once = v;
    this.ended = false;
    this.last = null;
  }

  /** The play-once run is over: hold its last frame (scene). */
  finish(last: LastBeat | null = null) {
    this.paused = true;
    this.ended = true;
    this.last = last;
  }

  /** Runs again from t = 0; `baked` switches back from the live sim to the baked run. */
  restart({ baked = false, paused = false }: { baked?: boolean; paused?: boolean } = {}) {
    this.ended = false;
    this.last = null;
    this.paused = paused;
    this.restartReq = { baked };
    this.pending = 0;
  }

  setPaused(v: boolean) {
    this.paused = v;
  }

  setSpeed(s: number) {
    this.speed = s;
  }

  slower() {
    this.speed = SPEEDS[Math.min(SPEEDS.length - 1, this.speedIndex + 1)] as number;
  }

  faster() {
    this.speed = SPEEDS[Math.max(0, this.speedIndex - 1)] as number;
  }

  setSource(log: SpikeLog, mode: 'baked' | 'live') {
    this.log = log;
    this.mode = mode;
  }

  setRange(start: number, end: number) {
    this.clock.start = start;
    this.clock.end = end;
  }

  /** Requests the clock at `t` (clamped to the range) on the scene's next frame. */
  seek(t: number) {
    const { start, end } = this.clock;
    this.pending = Math.min(end, Math.max(start, t));
  }

  /** Pauses and moves one step; steps taken before the next frame add up. */
  step(dir: -1 | 1) {
    this.paused = true;
    this.seek((this.pending ?? this.clock.t) + dir * STEP_MS);
  }

  /** The pending seek, once (scene, every frame). */
  takeSeek(): number | null {
    const t = this.pending;
    this.pending = null;
    return t;
  }

  run(a: PlaybackAction) {
    if (a === 'toggle') this.toggle();
    else if (a === 'back') this.step(-1);
    else if (a === 'forward') this.step(1);
    else if (a === 'slower') this.slower();
    else this.faster();
  }

  private get speedIndex() {
    const i = SPEEDS.indexOf(this.speed as (typeof SPEEDS)[number]);
    return i < 0 ? 0 : i;
  }
}

const KEYS: Record<string, PlaybackAction> = {
  ' ': 'toggle',
  ',': 'back',
  '.': 'forward',
  '[': 'slower',
  ']': 'faster',
};

/** Playback hotkey for a key press, or null (modified, unbound; only steps auto-repeat). */
export function playbackKey(e: KeyboardEvent): PlaybackAction | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  const a = KEYS[hotkey(e)] ?? null;
  if (e.repeat && a !== 'back' && a !== 'forward') return null;
  return a;
}

export const playback = new PlaybackStore();
