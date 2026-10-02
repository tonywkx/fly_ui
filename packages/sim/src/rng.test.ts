import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng';

const take = (seed: number, k: number) => {
  const rng = mulberry32(seed);
  return Array.from({ length: k }, rng);
};

describe('rng', () => {
  it('is reproducible per seed', () => {
    expect(take(42, 100)).toEqual(take(42, 100));
  });

  it('differs between seeds', () => {
    expect(take(1, 10)).not.toEqual(take(2, 10));
  });

  it('is uniform on [0, 1)', () => {
    const xs = take(7, 100_000);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(xs.reduce((a, b) => a + b, 0) / xs.length).toBeCloseTo(0.5, 2);
  });
});
