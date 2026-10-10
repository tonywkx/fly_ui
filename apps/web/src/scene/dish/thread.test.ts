import { describe, expect, it } from 'vitest';
import type { Vec3 } from './hologram';
import { cut, FADE_MS, HOLD_MS, REPLAY_FADE, REPLAY_HOLD, RUN_MS, threadAt, threadReplay } from './thread';

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

describe('threadReplay', () => {
  const e = { t: 140, ms: 30 };

  it('runs from the sense onset to the legs over the real latency', () => {
    expect(threadReplay(109, e, false)).toBeNull();
    expect(threadReplay(110, e, false)).toEqual({ drawn: 0, alpha: 1 });
    expect(threadReplay(125, e, false)?.drawn).toBeCloseTo(0.5);
    expect(threadReplay(140, e, false)).toEqual({ drawn: 1, alpha: 1 });
  });

  it('holds, fades, then is gone', () => {
    expect(threadReplay(140 + REPLAY_HOLD, e, false)?.alpha).toBe(1);
    expect(threadReplay(140 + REPLAY_HOLD + REPLAY_FADE / 2, e, false)?.alpha).toBeCloseTo(0.5);
    expect(threadReplay(140 + REPLAY_HOLD + REPLAY_FADE, e, false)).toBeNull();
  });

  it('draws forced cells whole at the decision', () => {
    const f = { t: 140, ms: null };
    expect(threadReplay(139, f, false)).toBeNull();
    expect(threadReplay(140, f, false)).toEqual({ drawn: 1, alpha: 1 });
  });

  it('draws whole from the onset with reduced motion', () => {
    expect(threadReplay(111, e, true)).toEqual({ drawn: 1, alpha: 1 });
  });
});
