import { describe, expect, it } from 'vitest';
import { INSET_SHARE, insetView } from './inset';

describe('insetView', () => {
  it('is null without an inset', () => {
    expect(insetView(1600, 1000, 0)).toBeNull();
  });

  it('centres the shrunk frame in the free strip, aspect kept', () => {
    const v = insetView(1600, 1000, 640);
    expect(v).not.toBeNull();
    if (!v) return;
    const s = 960 / (1600 * INSET_SHARE);
    expect(v.fullW).toBeCloseTo(1600 * s);
    expect(v.fullH).toBeCloseTo(1000 * s);
    expect(v.fullW / v.fullH).toBeCloseTo(1.6);
    // frame centre lands mid-strip, mid-height
    expect(-v.x + v.fullW / 2).toBeCloseTo(480);
    expect(-v.y + v.fullH / 2).toBeCloseTo(500);
  });

  it('never zooms in when the strip is wide enough', () => {
    const v = insetView(1600, 1000, 100);
    expect(v?.fullW).toBe(1600);
    expect(-(v?.x ?? 0) + 800).toBeCloseTo(750);
  });
});
