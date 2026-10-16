import { describe, expect, it } from 'vitest';
import { LABEL_FULL_MS, LABEL_MS, labelAt } from './label';

describe('labelAt', () => {
  it('draws the leader, then fades the text in', () => {
    expect(labelAt(0, false)).toEqual({ leader: 0, text: 0, alpha: 1 });
    expect(labelAt(150, false)?.text).toBe(0);
    const mid = labelAt(250, false);
    expect(mid?.leader).toBeGreaterThan(0.5);
    expect(mid?.text).toBeCloseTo(0.5);
    expect(labelAt(LABEL_FULL_MS, false)).toEqual({ leader: 1, text: 1, alpha: 1 });
  });

  it('holds for 4 s, fades out, then is gone', () => {
    expect(labelAt(LABEL_FULL_MS + 4000, false)).toEqual({ leader: 1, text: 1, alpha: 1 });
    expect(labelAt(LABEL_FULL_MS + 4200, false)?.alpha).toBeCloseTo(0.5);
    expect(labelAt(LABEL_MS, false)).toBeNull();
    expect(labelAt(-1, false)).toBeNull();
  });

  it('appears and disappears at once with reduced motion', () => {
    expect(labelAt(0, true)).toEqual({ leader: 1, text: 1, alpha: 1 });
    expect(labelAt(LABEL_FULL_MS + 3999, true)).toEqual({ leader: 1, text: 1, alpha: 1 });
    expect(labelAt(LABEL_FULL_MS + 4000, true)).toBeNull();
  });
});
