import type { ItemKind } from '@fly/sim';
import type { Hand } from '@/state/dish';
import type { Op, Outcome } from './verdict';

/**
 * A puzzle: a behaviour to bring about, solved by finding the operation behind it (8.12).
 * The fly starts at the centre heading +x, so «in front of her» is +x.
 */
export interface Level {
  op: Op;
  /** Items the level starts with, mm. */
  items: { kind: ItemKind; x: number; y: number }[];
  /** Tool put in hand at the start. */
  hand: Hand | null;
}

export const LEVELS: readonly Level[] = [
  { op: 'panic', items: [], hand: 'swatter' },
  { op: 'sugar', items: [{ kind: 'sugar', x: 2.5, y: 0 }], hand: null },
  { op: 'p1', items: [{ kind: 'female', x: 4, y: 0.5 }], hand: null },
  { op: 'moon', items: [], hand: null },
];

/** Rungs of the hint ladder; the last names the answer. */
export const HINTS = 3;

/** An outcome of `op` solves the level: the swatter landed, or the usual behaviour did not come. */
export function solves(l: Level, op: Op, o: Outcome): boolean {
  if (op !== l.op) return false;
  return op === 'panic' ? o.hit : o.line === 'verdict';
}

export const nextHint = (h: number): number => Math.min(h + 1, HINTS);
