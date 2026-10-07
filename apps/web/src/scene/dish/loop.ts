import {
  type Action,
  type Command,
  CommandMeter,
  type Decision,
  type Drive,
  decide,
  diffDrive,
  type Group,
  PATHS,
  type PuppetKey,
  type SENSES,
  type Senses,
  senseDrive,
  type World,
  type WorldEvent,
} from '@fly/sim';
import { type Op, TAIL_MS, Verdicts } from './verdict';

/** World step and decision tick, sim ms (as the 8.3 calibration in `explore/bridge.ts`). */
const TICK = 1;

type Sense = keyof typeof SENSES;
type Side = 'L' | 'R';

/** Keys the visitor holds (puppet mode): cells driven (↑ ↓) and steering (← →). */
export const PULLS = ['up', 'down', 'left', 'right'] as const satisfies readonly (
  | PuppetKey
  | 'left'
  | 'right'
)[];
export type Pull = (typeof PULLS)[number];

/** A switch into a decision: what, when, how long after its sense came on, and from which side. */
export interface DecisionEvent {
  action: Decision;
  t: number;
  /** Sense onset → decision, sim ms; null when the sense was off (forced cells). */
  ms: number | null;
  /** The stronger eye for loom / female; null for taste or without a sense. */
  side: Side | null;
  /** No sense, but the visitor held this puppet key (set by `DishRun`). */
  pull?: PuppetKey;
}

/** A sense's level and stronger side. */
function level(s: Senses, k: Sense): { on: boolean; side: Side | null } {
  const v = s[k];
  if (typeof v === 'number') return { on: v > 0, side: null };
  return { on: v.L > 0 || v.R > 0, side: v.L >= v.R ? 'L' : 'R' };
}

/** Spike source by time: the live client's `SpikeLog` (log rows = the watched command groups). */
export interface Spikes {
  until: number;
  times: Float32Array;
  rows: Uint32Array;
  span(from: number, to: number): [number, number];
}

/**
 * The Terrarium closed loop: what the fly senses → drive on sensory rows (only changes are sent),
 * command spikes → meter → `decide` → `world.step`. Runs in sim time and never past the spikes.
 */
export class DishLoop {
  /** Sim time reached, ms. */
  t = 0;
  action: Action = 'walk';
  /** Each op's last encounter; ops changed since the caller last drained `changed`. */
  readonly verdicts = new Verdicts();
  readonly changed = new Set<Op>();
  /** Decisions since the caller last drained this list. */
  readonly decisions: DecisionEvent[] = [];
  private readonly meter: CommandMeter;
  /** Per sense: rising edge, last tick on and side (null = off for longer than `TAIL_MS`). */
  private onset: Partial<Record<Sense, { t0: number; last: number; side: Side | null }>> = {};
  private prev = new Map<number, number>();

  constructor(
    readonly world: World,
    /** Sensory groups in full-graph rows (drive). */
    private readonly senses: Record<keyof typeof SENSES, Group>,
    /** Command groups in log rows (meter). */
    commands: Record<Command, Group>,
    private readonly sim: { drive(d: Drive): void },
  ) {
    this.meter = new CommandMeter(commands);
  }

  /** Steps the world up to `to` (or as far as `log` reaches); returns what happened. */
  advance(to: number, log: Spikes): WorldEvent[] {
    const ev: WorldEvent[] = [];
    const end = Math.min(to, log.until);
    while (this.t + TICK <= end) {
      const [i0, i1] = log.span(this.t, this.t + TICK);
      if (i1 > i0) this.meter.add({ t: log.times.subarray(i0, i1), row: log.rows.subarray(i0, i1) });
      this.t += TICK;
      const r = this.meter.rates(this.t);
      const prev = this.action;
      this.action = decide(r, prev);
      if (this.action !== prev && this.action !== 'walk') this.decided(this.action);
      const step = this.world.step(TICK, this.action);
      ev.push(...step);
      const s = this.world.sense();
      this.track(s);
      for (const op of this.verdicts.tick(this.t, s, r, this.action, step)) this.changed.add(op);
      this.send(senseDrive(s, this.senses));
    }
    return ev;
  }

  /** Dish, clock and drive back to the start (the caller resets the sim and its log). */
  reset(): void {
    this.world.reset();
    this.t = 0;
    this.action = 'walk';
    this.meter.reset();
    this.verdicts.reset();
    this.changed.clear();
    this.decisions.length = 0;
    this.onset = {};
    this.send(new Map());
  }

  private track(s: Senses): void {
    for (const k of Object.keys(PATHS).map((d) => PATHS[d as Decision].sense)) {
      const { on, side } = level(s, k);
      const o = this.onset[k];
      if (on) this.onset[k] = { t0: o?.t0 ?? this.t, last: this.t, side };
      else if (o && this.t - o.last > TAIL_MS) delete this.onset[k];
    }
  }

  private decided(action: Decision): void {
    const o = this.onset[PATHS[action].sense];
    this.decisions.push({ action, t: this.t, ms: o ? this.t - o.t0 : null, side: o?.side ?? null });
  }

  private send(next: Map<number, number>): void {
    const d = diffDrive(this.prev, next);
    this.prev = next;
    if (d.rows.length) this.sim.drive(d);
  }
}
