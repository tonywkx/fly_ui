import type { Rates, WorldEvent } from '@fly/sim';
import type { Result } from './discoveries';
import type { DecisionEvent } from './loop';

/** A run ends this long after the first decision (the action plays out; a swatter hit is at 120 ms), sim ms. */
export const TAIL = 300;
/** …or this long after the start with no decision (latest normal decision 113 ms, TERRARIUM §Norm table). */
export const TIMEOUT = 600;

export interface TakeResult {
  result: Result;
  /** Sense onset → first decision, sim ms. */
  ms: number | null;
  /** Peak of the deciding command over the run, Hz per cell (0 with no decision). */
  hz: number;
  /** Every command's peak (the card reads the norm's command too). */
  peak: Rates;
}

/** One scripted run as `explore/norm.ts` reads it: the first decision, a hit, when it is over. */
export class Take {
  private first: DecisionEvent | null = null;
  private hit = false;

  constructor(readonly t0: number) {}

  /** The run's first decision so far. */
  get decision(): DecisionEvent | null {
    return this.first;
  }

  /** The loop's decisions and world events since the last feed. */
  feed(decisions: readonly DecisionEvent[], events: readonly WorldEvent[]): void {
    this.first ??= decisions.find((x) => x.t >= this.t0) ?? null;
    if (events.some((e) => e.kind === 'hit')) this.hit = true;
  }

  done(t: number): boolean {
    return this.first ? t - this.first.t >= TAIL : t - this.t0 >= TIMEOUT;
  }

  result(peak: Rates): TakeResult {
    const a = this.first?.action;
    return {
      result: this.hit ? 'hit' : (a ?? 'walk'),
      ms: this.first?.ms ?? null,
      hz: a ? Math.round(peak[a]) : 0,
      peak: { ...peak },
    };
  }
}
