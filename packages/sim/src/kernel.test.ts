import { describe, expect, it } from 'vitest';
import { Kernel } from './kernel';

describe('kernel', () => {
  it('reads a steady train as its rate', () => {
    const k = new Kernel(20);
    for (let t = 0; t < 1000; t += 5) k.add(t); // 200 Hz on one cell; read between spikes
    expect(k.hz(997.5, 1)).toBeGreaterThan(190);
    expect(k.hz(997.5, 1)).toBeLessThan(215);
    expect(k.hz(997.5, 2)).toBeCloseTo(k.hz(997.5, 1) / 2, 9);
  });

  it('decays without spikes and reads 0 for an empty group', () => {
    const k = new Kernel(20);
    k.add(0);
    expect(k.hz(0, 1)).toBeCloseTo(50, 9);
    expect(k.hz(20, 1)).toBeCloseTo(50 / Math.E, 9);
    expect(k.hz(0, 0)).toBe(0);
  });
});
