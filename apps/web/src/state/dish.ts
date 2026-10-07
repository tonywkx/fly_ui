import { makeAutoObservable } from 'mobx';
import type { Op, Outcome } from '@/scene/dish/verdict';

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
  /** The open operation card. */
  open: Op | null = 'panic';
  /** Cells per operation, once the live brain is up. */
  cells: Record<Op, number> | null = null;
  /** Each operation's last live encounter. */
  now: Partial<Record<Op, Outcome>> = {};
  /** The operation whose outcome changed last (announced). */
  last: Op | null = null;

  constructor() {
    makeAutoObservable(this);
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
