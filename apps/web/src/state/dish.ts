import { makeAutoObservable } from 'mobx';

/** The visitor's own strikes (TERRARIUM-SHAPE §Hands): tools in hand, not items in the dish. */
export type Hand = 'shadow' | 'swatter';

/** Terrarium UI state that React shows: the tool in hand and whether the dish is empty. Never per frame. */
export class DishStore {
  hand: Hand | null = null;
  empty = true;

  constructor() {
    makeAutoObservable(this);
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
