import type { Action, OPERATIONS, Rates, Senses, WorldEvent } from '@fly/sim';

export type Op = keyof typeof OPERATIONS;
export const OPS = ['panic', 'moon', 'sugar', 'p1'] as const satisfies readonly Op[];

/** What the last encounter of an operation's kind showed (the card's «now» line). */
export interface Outcome {
  /** `did`: the usual behaviour happened; `verdict`: it did not (moon: backed off with no bitter). */
  line: 'did' | 'verdict';
  /** Peak read-out rate, Hz per cell, rounded. */
  hz: number;
  /** Encounter start → behaviour, sim ms (null if it never came). */
  ms: number | null;
  /** The swatter landed on the fly during the encounter. */
  hit: boolean;
}

/**
 * The reference run of 8.1 (docs/TERRARIUM.md §Surgeon operations, seed 1) — the card's «usually» line.
 * Each op reads the command named like its behaviour: TTMn (jump), MDN (back), MN9 (eat), pIP10 (court).
 */
export const USUAL: Record<Op, { hz: number; ms: number | null }> = {
  panic: { hz: 227, ms: 8 },
  moon: { hz: 0, ms: null },
  sugar: { hz: 224, ms: 22 },
  p1: { hz: 90, ms: 16 },
};

/** Read-out command and behaviour of each op (the same name in `Rates` and `Action`). */
const ACT: Record<Op, Action & keyof Rates> = { panic: 'jump', moon: 'back', sugar: 'eat', p1: 'court' };

/** What starts an encounter: the stimulus the op is about (moon: the backing itself). */
const CUE: Record<Op, (s: Senses, a: Action) => boolean> = {
  panic: (s) => s.loom.L > 0 || s.loom.R > 0,
  moon: (_, a) => a === 'back',
  sugar: (s) => s.sugar > 0,
  p1: (s) => s.female.L > 0 || s.female.R > 0,
};

/** Cue gone this long ends the encounter, sim ms (a jump and the kernel peak trail the loom). */
export const TAIL_MS = 60;
/** A cue still on after this long publishes once (MDN on backs forever, a female may stay in view). */
export const HOLD_MS = 200;

interface Live {
  t0: number;
  /** Last tick with the cue on. */
  last: number;
  peak: number;
  ms: number | null;
  hit: boolean;
  bitter: boolean;
  /** Line already published while the encounter goes on. */
  shown: Outcome['line'] | null;
}

/** Tracks encounters per op from the closed loop's ticks and keeps each op's last outcome. */
export class Verdicts {
  readonly now: Record<Op, Outcome | null> = { panic: null, moon: null, sugar: null, p1: null };
  private live: Partial<Record<Op, Live>> = {};

  /** One loop tick at sim `t`; returns the ops whose outcome changed. */
  tick(t: number, s: Senses, r: Rates, a: Action, ev: readonly WorldEvent[] = []): Op[] {
    const out: Op[] = [];
    for (const op of OPS) {
      const act = ACT[op];
      let e = this.live[op];
      if (CUE[op](s, a)) {
        if (!e)
          e = this.live[op] = { t0: t, last: t, peak: 0, ms: null, hit: false, bitter: false, shown: null };
        e.last = t;
      }
      if (!e) continue;
      e.peak = Math.max(e.peak, r[act]);
      if (e.ms === null && a === act) e.ms = t - e.t0;
      if (s.bitter > 0) e.bitter = true;
      if (ev.some((x) => x.kind === 'hit')) e.hit = true;
      if (t - e.last >= TAIL_MS) {
        this.now[op] = this.outcome(op, e);
        delete this.live[op];
        out.push(op);
      } else if (t - e.t0 >= HOLD_MS) {
        const o = this.outcome(op, e);
        if (o.line !== e.shown) {
          e.shown = o.line;
          this.now[op] = o;
          out.push(op);
        }
      }
    }
    return out;
  }

  reset(): void {
    this.live = {};
    for (const op of OPS) this.now[op] = null;
  }

  private outcome(op: Op, e: Live): Outcome {
    const did = op === 'moon' ? e.bitter : e.ms !== null;
    return { line: did ? 'did' : 'verdict', hz: Math.round(e.peak), ms: e.ms, hit: e.hit };
  }
}
