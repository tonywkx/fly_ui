import {
  type Action,
  type Command,
  CommandMeter,
  type Drive,
  decide,
  diffDrive,
  type Group,
  type SENSES,
  senseDrive,
  type World,
  type WorldEvent,
} from '@fly/sim';
import { type Op, Verdicts } from './verdict';

/** World step and decision tick, sim ms (as the 8.3 calibration in `explore/bridge.ts`). */
const TICK = 1;

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
  private readonly meter: CommandMeter;
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
      this.action = decide(r, this.action);
      const step = this.world.step(TICK, this.action);
      ev.push(...step);
      const s = this.world.sense();
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
    this.send(new Map());
  }

  private send(next: Map<number, number>): void {
    const d = diffDrive(this.prev, next);
    this.prev = next;
    if (d.rows.length) this.sim.drive(d);
  }
}
