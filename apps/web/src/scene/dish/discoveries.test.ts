import { describe, expect, it } from 'vitest';
import {
  CARD_STIMULI,
  chips,
  DISCOVERIES,
  discovery,
  normOf,
  type Pair,
  pairId,
  parsePair,
  type Result,
  shuffle,
} from './discoveries';

/** Bet chips of docs/TERRARIUM.md §Discoveries, in table order. */
const BETS: Result[][] = [
  ['eat', 'walk', 'back'],
  ['back', 'eat', 'walk'],
  ['jump', 'back', 'walk'],
  ['court', 'walk', 'back'],
  ['jump', 'hit', 'back'],
  ['eat', 'walk', 'back'],
  ['court', 'walk', 'back'],
  ['walk', 'back', 'jump'],
  ['jump', 'walk', 'back'],
  ['eat', 'back', 'walk'],
  ['court', 'back', 'walk'],
  ['back', 'walk', 'eat'],
];

describe('discoveries', () => {
  it('12 distinct pairs from the card slots', () => {
    expect(DISCOVERIES).toHaveLength(12);
    expect(new Set(DISCOVERIES.map((d) => d.id)).size).toBe(12);
    for (const d of DISCOVERIES) expect(CARD_STIMULI).toContain(d.stim);
  });

  it('chips match the 9.2 bet table', () => {
    DISCOVERIES.forEach((d, i) => {
      expect([...chips(d)].sort()).toEqual([...(BETS[i] ?? [])].sort());
    });
  });

  it('any pair: three distinct chips with the norm and the operated result', () => {
    for (const stim of CARD_STIMULI)
      for (const op of ['none', 'panic', 'moon', 'sugar', 'p1'] as const) {
        const c = chips({ stim, op });
        expect(new Set(c).size).toBe(3);
        expect(c).toContain(normOf({ stim, op: 'none' }));
        expect(c).toContain(normOf({ stim, op }));
      }
  });

  it('swatter × DNp01 off: the norm says hit', () => {
    expect(normOf({ stim: 'swatter', op: 'panic' })).toBe('hit');
    expect(normOf({ stim: 'swatter', op: 'none' })).toBe('jump');
  });

  it('the puzzles are discoveries 5–8, one per level', () => {
    const guided = DISCOVERIES.filter((d) => d.level !== undefined);
    expect(guided.map((d) => DISCOVERIES.indexOf(d))).toEqual([4, 5, 6, 7]);
    // Phase 8 order (`fly_ui.levels` indices): swatter, sugar, P1, MDN
    expect(guided.map((d) => [d.level, d.op])).toEqual([
      [0, 'panic'],
      [1, 'sugar'],
      [2, 'p1'],
      [3, 'moon'],
    ]);
  });

  it('shuffle is a seeded permutation', () => {
    const c = chips({ stim: 'sugar', op: 'none' });
    expect(shuffle(c, 7)).toEqual(shuffle(c, 7));
    expect([...shuffle(c, 7)].sort()).toEqual([...c].sort());
    const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => shuffle(c, s).join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('pair ids round-trip; junk is null', () => {
    const p: Pair = { stim: 'swatter', op: 'panic' };
    expect(pairId(p)).toBe('swatter:panic');
    expect(parsePair('swatter:panic')).toEqual(p);
    expect(parsePair('sugar')).toEqual({ stim: 'sugar', op: 'none' });
    expect(parsePair('banana:none')).toBeNull();
    expect(parsePair('sugar:p1on')).toBeNull();
    expect(discovery(p)?.id).toBe('swatter:panic');
    expect(discovery({ stim: 'swatter', op: 'moon' })).toBeNull();
  });
});
