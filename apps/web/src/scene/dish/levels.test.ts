import { describe, expect, it } from 'vitest';
import { HINTS, LEVELS, nextHint, solves } from './levels';
import type { Outcome } from './verdict';

const out = (o: Partial<Outcome>): Outcome => ({ line: 'did', hz: 0, ms: null, hit: false, ...o });

describe('levels', () => {
  it('one level per operation, each op once', () => {
    expect(LEVELS.map((l) => l.op).sort()).toEqual(['moon', 'p1', 'panic', 'sugar']);
  });

  it('setup items lie inside the dish', () => {
    for (const l of LEVELS) for (const it of l.items) expect(Math.hypot(it.x, it.y)).toBeLessThan(12);
  });

  it('swat: only a hit solves it', () => {
    const swat = LEVELS[0];
    expect(swat?.op).toBe('panic');
    if (!swat) return;
    expect(solves(swat, 'panic', out({ line: 'verdict', hz: 44 }))).toBe(false);
    expect(solves(swat, 'panic', out({ line: 'verdict', hz: 44, hit: true }))).toBe(true);
  });

  it('the others: the verdict line of their own op', () => {
    for (const l of LEVELS.slice(1)) {
      expect(solves(l, l.op, out({ line: 'verdict' }))).toBe(true);
      expect(solves(l, l.op, out({ line: 'did' }))).toBe(false);
      const other = LEVELS.find((x) => x.op !== l.op)?.op;
      if (other) expect(solves(l, other, out({ line: 'verdict', hit: true }))).toBe(false);
    }
  });

  it('hints climb to the last rung and stay', () => {
    expect(nextHint(0)).toBe(1);
    expect(nextHint(HINTS)).toBe(HINTS);
  });
});
