import { makeAutoObservable } from 'mobx';
import { HINTS, LEVELS, nextHint, solves } from '../scene/dish/levels';
import type { DecisionEvent, Pull } from '../scene/dish/loop';
import type { Op, Outcome } from '../scene/dish/verdict';
import type { WhyHop } from '../scene/dish/why';

/** The visitor's own strikes (TERRARIUM-SHAPE §Hands): tools in hand, not items in the dish. */
export type Hand = 'shadow' | 'swatter';

/**
 * Terrarium UI state that React shows: the tool in hand, whether the dish is empty, the surgeon's
 * operations and their last outcomes. Never per frame (outcomes change once per encounter).
 */
export class DishStore {
  hand: Hand | null = null;
  empty = true;
  /** Operations switched on. */
  ops = new Set<Op>();
  /** Puppet keys held (arrows). */
  pulls = new Set<Pull>();
  /** The open operation card. */
  open: Op | null = 'panic';
  /** Cells per operation, once the live brain is up. */
  cells: Record<Op, number> | null = null;
  /** Each operation's last live encounter. */
  now: Partial<Record<Op, Outcome>> = {};
  /** The operation whose outcome changed last (announced). */
  last: Op | null = null;
  /** The fly's last decision (the caption under the dish); null after a reset. */
  decision: DecisionEvent | null = null;
  /** Its chain from the live log (the «why?» card); the card is open while `whyOpen`. */
  why: WhyHop[] | null = null;
  whyOpen = false;
  /** The fly ↔ neuron zoom is flying (the chrome steps aside). */
  zooming = false;
  /** Cells the brain view silenced / drove, now on in the fly (null = none). */
  brain: { off: number; on: number } | null = null;
  /** The puzzle on the strip (index into `LEVELS`); null = free play. */
  level: number | null = null;
  /** Hint rungs shown for it. */
  hint = 0;
  /** The outcome that solved it, once solved. */
  won: Outcome | null = null;
  /** Puzzles solved, remembered per browser. */
  solved: Set<number>;
  /** Bumped on each (re)start of a puzzle: the dish resets and lays it out. */
  round = 0;

  constructor(private readonly memory: LevelMemory = levelMemory) {
    this.solved = new Set(memory.load().solved);
    makeAutoObservable<this, 'memory'>(this, { memory: false });
  }

  /**
   * The puzzle to open with: `?level=` (0 = none), else none when the visitor closed the strip, came
   * with a set-up dish or solved them all, else the first unsolved one.
   */
  firstLevel(param: number | undefined, setUp: boolean): number | null {
    if (param !== undefined) return param > 0 ? param - 1 : null;
    if (setUp || this.memory.load().closed) return null;
    const i = LEVELS.findIndex((_, i) => !this.solved.has(i));
    return i < 0 ? null : i;
  }

  /** Lay a puzzle out: operations off, no card open, its tool in hand; the dish resets (`round`). */
  startLevel(i: number): void {
    const l = LEVELS[i];
    if (!l) return;
    this.level = i;
    this.hint = 0;
    this.won = null;
    this.ops.clear();
    this.open = null;
    this.hand = l.hand;
    this.round++;
  }

  nextLevel(): void {
    if (this.level !== null) this.startLevel(this.level + 1);
  }

  /** One more rung; the last opens the answer's card. */
  showHint(): void {
    if (this.level === null) return;
    this.hint = nextHint(this.hint);
    if (this.hint === HINTS) this.open = LEVELS[this.level]?.op ?? null;
  }

  setHint(h: number): void {
    this.hint = Math.min(Math.max(h, 0), HINTS);
    if (this.hint === HINTS && this.level !== null) this.open = LEVELS[this.level]?.op ?? null;
  }

  /** Free play; remembered, so the strip stays closed on the next visit. */
  closeLevels(): void {
    this.level = null;
    this.memory.save({ solved: [...this.solved], closed: true });
  }

  /** Back to the puzzles at the first unsolved one (or the first). */
  openLevels(): void {
    const i = LEVELS.findIndex((_, i) => !this.solved.has(i));
    this.memory.save({ solved: [...this.solved], closed: false });
    this.startLevel(Math.max(i, 0));
  }

  setBrain(n: { off: number; on: number } | null): void {
    this.brain = n;
  }

  setZooming(on: boolean): void {
    this.zooming = on;
  }

  toggleOp(op: Op): void {
    if (this.ops.has(op)) this.ops.delete(op);
    else this.ops.add(op);
  }

  setOps(ops: Iterable<Op>): void {
    this.ops = new Set(ops);
  }

  clearOps(): void {
    this.ops.clear();
  }

  /** A puppet key pressed (`on`) or let go. */
  pull(k: Pull, on: boolean): void {
    if (on) this.pulls.add(k);
    else this.pulls.delete(k);
  }

  /** Let go of all keys (window blur); a list holds them (snaps). */
  setPulls(keys: Iterable<Pull> = []): void {
    this.pulls = new Set(keys);
  }

  setOpen(op: Op | null): void {
    this.open = op;
  }

  /** Open a card; the open one again closes it. */
  toggleOpen(op: Op): void {
    this.open = this.open === op ? null : op;
  }

  setCells(n: Record<Op, number>): void {
    this.cells = n;
  }

  setDecision(d: DecisionEvent | null, why: WhyHop[] | null = null): void {
    this.decision = d;
    this.why = why;
    if (!d) this.whyOpen = false;
  }

  setWhyOpen(open: boolean): void {
    this.whyOpen = open && !!this.why;
  }

  setNow(op: Op, o: Outcome): void {
    this.now[op] = o;
    this.last = op;
    const l = this.level === null ? undefined : LEVELS[this.level];
    if (this.level !== null && l && !this.won && solves(l, op, o)) {
      this.won = o;
      this.solved.add(this.level);
      this.memory.save({ solved: [...this.solved], closed: false });
    }
  }

  /** Pick a tool up; the same tool again puts it down. */
  toggleHand(h: Hand): void {
    this.hand = this.hand === h ? null : h;
  }

  putDown(): void {
    this.hand = null;
  }

  setEmpty(empty: boolean): void {
    this.empty = empty;
  }
}

export interface LevelMemory {
  load(): { solved: number[]; closed: boolean };
  save(m: { solved: number[]; closed: boolean }): void;
}

const LEVELS_KEY = 'fly_ui.levels';

/** localStorage-backed; missing / throwing storage = nothing solved, nothing remembered. */
export const levelMemory: LevelMemory = {
  load() {
    try {
      const m = JSON.parse(localStorage.getItem(LEVELS_KEY) ?? 'null');
      const solved = Array.isArray(m?.solved) ? m.solved.filter(Number.isInteger) : [];
      return { solved, closed: m?.closed === true };
    } catch {
      return { solved: [], closed: false };
    }
  },
  save(m) {
    try {
      localStorage.setItem(LEVELS_KEY, JSON.stringify(m));
    } catch {
      // not remembered: fine
    }
  },
};

export const dish = new DishStore();
