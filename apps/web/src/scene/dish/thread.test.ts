import { describe, expect, it } from 'vitest';
import type { Vec3 } from './hologram';
import { cut, FADE_MS, HOLD_MS, RUN_MS, threadAt } from './thread';

const L: Vec3[] = [
  [0, 0, 0],
  [3, 0, 0],
  [3, 1, 0],
];

describe('thread', () => {
  it('cuts the polyline at a share of its length', () => {
    expect(cut(L, 0).at(-1)).toEqual([0, 0, 0]);
    expect(cut(L, 0.5)).toEqual([
      [0, 0, 0],
      [2, 0, 0],
    ]);
    expect(cut(L, 0.875)).toEqual([
      [0, 0, 0],
      [3, 0, 0],
      [3, 0.5, 0],
    ]);
    expect(cut(L, 1)).toHaveLength(3);
    expect(cut([], 1)).toEqual([]);
  });

  it('runs, holds, fades, then is gone', () => {
    expect(threadAt(RUN_MS / 2, false)).toEqual({ drawn: 0.5, alpha: 1 });
    expect(threadAt(RUN_MS + HOLD_MS, false)).toEqual({ drawn: 1, alpha: 1 });
    expect(threadAt(RUN_MS + HOLD_MS + FADE_MS / 2, false)?.alpha).toBeCloseTo(0.5);
    expect(threadAt(RUN_MS + HOLD_MS + FADE_MS, false)).toBeNull();
    expect(threadAt(-1, false)).toBeNull();
  });

  it('is drawn whole at once under reduced motion', () => {
    expect(threadAt(0, true)).toEqual({ drawn: 1, alpha: 1 });
    expect(threadAt(HOLD_MS + FADE_MS, true)).toBeNull();
  });
});
