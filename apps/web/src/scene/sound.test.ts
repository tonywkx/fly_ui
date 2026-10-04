import { describe, expect, it } from 'vitest';
import { SpikeLog } from '../sim/feed';
import { clicks, continuous } from './sound';

function log(t: number[], row: number[], until = 1000) {
  const l = new SpikeLog();
  l.push(t, row, until);
  return l;
}

describe('clicks', () => {
  it('turns each spike of (t0, t1] into a click at its real-time offset', () => {
    const l = log([10, 11, 12, 15], [0, 1, 2, 3]);
    // 40 sim ms per real second: 1 sim ms = 25 ms real
    const c = clicks(l, 10, 12, 40, { max: 8 });
    expect(c.map((k) => k.dt)).toEqual([0.025, 0.05]);
    expect(c.every((k) => k.gain === c[0]?.gain)).toBe(true);
  });

  it('is silent when the clock did not move', () => {
    const l = log([10, 11], [0, 1]);
    expect(clicks(l, 11, 11, 40, { max: 8 })).toEqual([]);
    expect(clicks(l, 12, 10, 40, { max: 8 })).toEqual([]);
  });

  it('listens only to the probed rows when given', () => {
    const l = log([1, 2, 3, 4], [0, 1, 2, 1]);
    const c = clicks(l, 0, 5, 40, { max: 8, rows: [1] });
    expect(c.map((k) => k.dt)).toEqual([0.05, 0.1]);
  });

  it('thins a volley evenly to `max`, louder per click', () => {
    const n = 100;
    const t = Array.from({ length: n }, (_, k) => 1 + k * 0.01);
    const l = log(
      t,
      t.map((_, k) => k),
    );
    const one = clicks(log([1], [0]), 0, 2, 40, { max: 4 });
    const c = clicks(l, 0, 2, 40, { max: 4 });
    expect(c).toHaveLength(4);
    // spread over the volley, in order
    const dts = c.map((k) => k.dt);
    expect(dts).toEqual([...dts].sort((a, b) => a - b));
    expect(dts[0]).toBeLessThan(0.025 + 0.25 * 0.025);
    expect(dts[3]).toBeGreaterThan(0.025 + 0.75 * 0.025);
    expect(c[0]?.gain).toBeGreaterThan(one[0]?.gain ?? 1);
    expect(c[0]?.gain).toBeLessThanOrEqual(1);
  });
});

describe('continuous', () => {
  it('accepts a normal play step, rejects pause, seeks and loop wraps', () => {
    expect(continuous(10, 10.7, 40)).toBe(true);
    expect(continuous(10, 10, 40)).toBe(false);
    expect(continuous(10, 5, 40)).toBe(false);
    expect(continuous(10, 60, 40)).toBe(false);
  });
});
