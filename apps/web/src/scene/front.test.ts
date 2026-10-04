import { describe, expect, it } from 'vitest';
import { SpikeLog } from '../sim/feed';
import { activityFront } from './front';

/** Rows: 0 at x=0, 1 at x=10, 2 at x=20 (radius 2); 3 has no segments. */
const bounds = Float32Array.from([0, 0, 0, 2, 10, 0, 0, 2, 20, 0, 0, 2, 5, 5, 5, -1]);

function log(t: number[], row: number[]) {
  const l = new SpikeLog();
  l.push(t, row, 100);
  return l;
}

describe('activityFront', () => {
  it('is null without spikes in the window', () => {
    expect(activityFront(log([], []), 50, bounds)).toBeNull();
    expect(activityFront(log([1], [0]), 50, bounds, { windowMs: 30 })).toBeNull();
  });

  it('centres a lone spike on its neuron, framing part of it', () => {
    const f = activityFront(log([49], [1]), 50, bounds);
    expect(f?.center).toEqual([10, 0, 0]);
    expect(f?.radius).toBeCloseTo(1);
  });

  it('puts equally fresh spikes at their midpoint, spread adds to the radius', () => {
    const f = activityFront(log([50, 50], [0, 2]), 50, bounds);
    expect(f?.center[0]).toBeCloseTo(10);
    expect(f?.radius).toBeCloseTo(10 + 1);
  });

  it('lets the fresher spike pull harder', () => {
    const f = activityFront(log([30, 50], [0, 2]), 50, bounds, { windowMs: 30, tauMs: 10 });
    expect(f?.center[0]).toBeGreaterThan(15);
    expect(f?.center[0]).toBeLessThan(20);
  });

  it('ignores spikes after t and rows without segments', () => {
    const f = activityFront(log([49, 49, 60], [0, 3, 2]), 50, bounds);
    expect(f?.center).toEqual([0, 0, 0]);
  });

  it('is null once the weight fades below the floor', () => {
    expect(activityFront(log([20], [0]), 50, bounds, { windowMs: 40, tauMs: 10, minWeight: 0.1 })).toBeNull();
    expect(
      activityFront(log([45], [0]), 50, bounds, { windowMs: 40, tauMs: 10, minWeight: 0.1 }),
    ).not.toBeNull();
  });
});
