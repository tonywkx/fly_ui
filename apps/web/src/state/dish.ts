import { makeAutoObservable } from 'mobx';
import type { DecisionEvent, Pull } from '../scene/dish/loop';
import type { Recorded } from '../scene/dish/replay';
import type { Op, Outcome } from '../scene/dish/verdict';

/** The visitor's own strikes (TERRARIUM-SHAPE §Hands): tools in hand, not items in the dish. */
export type Hand = 'shadow' | 'swatter';

/** The phone sheet's tabs (8.14); the desktop shows all three at once. */
export const TABS = ['items', 'ops', 'puppet'] as const;
export type Tab = (typeof TABS)[number];

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
  /** The phone sheet's tab; opening a card shows the operations. */
  tab: Tab = 'items';
  /** Cells per operation, once the live brain is up. */
  cells: Record<Op, number> | null = null;
  /** Each operation's last live encounter. */
  now: Partial<Record<Op, Outcome>> = {};
  /** The operation whose outcome changed last (announced). */
  last: Op | null = null;
  /** The fly's last decision (the caption under the dish); null after a reset. */
  decision: DecisionEvent | null = null;
  /** What the last run's replay explains (its caption); null before any run. */
  recorded: Recorded | null = null;
  /** The fly ↔ neuron zoom is flying (the chrome steps aside). */
  zooming = false;
  /** Cells the brain view silenced / drove, now on in the fly (null = none). */
  brain: { off: number; on: number } | null = null;

  constructor() {
    makeAutoObservable(this);
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
    if (op) this.tab = 'ops';
  }

  setTab(tab: Tab): void {
    this.tab = tab;
  }

  /** Open a card; the open one again closes it. */
  toggleOpen(op: Op): void {
    this.open = this.open === op ? null : op;
  }

  setCells(n: Record<Op, number>): void {
    this.cells = n;
  }

  setDecision(d: DecisionEvent | null): void {
    this.decision = d;
  }

  setRecorded(r: Recorded): void {
    this.recorded = r;
  }

  setNow(op: Op, o: Outcome): void {
    this.now[op] = o;
    this.last = op;
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

export const dish = new DishStore();
