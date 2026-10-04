import { describe, expect, it } from 'vitest';
import { SpikeLog } from '../sim/feed';
import { Behavior, EFFECTOR, effectorMask } from './behavior';

/** Rows: 0 TTMn, 1 MN9, 2 hg1 MN, 3 ps1 MN, 4 DNp01, 5 untyped. */
const types = ['TTMn', 'MN9', 'hg1 MN', 'ps1 MN', 'DNp01'];
const meta = { n: 6, type: Uint16Array.from([0, 1, 2, 3, 4, 0xffff]), strings: { types } };
const mask = effectorMask(meta);

function log(t: number[], row: number[], until = 1000) {
  const l = new SpikeLog();
  l.push(t, row, until);
  return l;
}

/** `n` spikes of `row` every `dt` ms from `t0`. */
function train(row: number, t0: number, n: number, dt: number) {
  const t = Array.from({ length: n }, (_, k) => t0 + k * dt);
  return { t, row: t.map(() => row) };
}

describe('effectorMask', () => {
  it('maps motor types to effectors, everything else to none', () => {
    expect([...mask]).toEqual([
      EFFECTOR.jump,
      EFFECTOR.proboscis,
      EFFECTOR.wing,
      EFFECTOR.wing,
      EFFECTOR.none,
      EFFECTOR.none,
    ]);
  });
});

describe('Behavior', () => {
  it('rests without motor spikes', () => {
    const b = new Behavior(mask);
    const p = b.update(log([10, 20], [4, 5]), 50);
    expect(p).toMatchObject({ jumpAt: null, lift: 0, proboscis: 0, wing: 0, flick: 0 });
  });

  it('jumps once TTMn fires hard, lift grows with time since takeoff', () => {
    const s = train(0, 8, 20, 4); // 250 Hz from 8 ms
    const l = log(s.t, s.row);
    const b = new Behavior(mask);
    expect(b.update(l, 5).jumpAt).toBeNull();
    const early = b.update(l, 35);
    expect(early.jumpAt).not.toBeNull();
    expect(early.jumpAt).toBeGreaterThanOrEqual(8);
    expect(early.jumpAt).toBeLessThanOrEqual(35);
    const later = b.update(l, 60);
    expect(later.jumpAt).toBe(early.jumpAt);
    expect(later.lift).toBeGreaterThan(early.lift);
    expect(b.update(l, 96).lift).toBe(1);
  });

  it('comes back once TTMn has been quiet for a while', () => {
    const s = train(0, 8, 20, 4); // last spike at 84 ms
    const b = new Behavior(mask);
    expect(b.update(log(s.t, s.row), 500)).toMatchObject({ jumpAt: null, lift: 0 });
  });

  it('does not jump on a lone TTMn spike', () => {
    const b = new Behavior(mask);
    expect(b.update(log([10], [0]), 30).jumpAt).toBeNull();
  });

  it('rebuilds from the log on a seek back: same pose as a straight run', () => {
    const s = train(0, 8, 20, 4);
    const l = log(s.t, s.row);
    const b = new Behavior(mask);
    b.update(l, 200);
    expect(b.update(l, 5)).toMatchObject({ jumpAt: null, lift: 0 });
    const straight = new Behavior(mask).update(l, 30);
    expect(b.update(l, 30)).toEqual(straight);
  });

  it('extends the proboscis with MN9 rate and retracts after it stops', () => {
    const s = train(1, 0, 40, 10); // 100 Hz, 0..390 ms
    const l = log(s.t, s.row);
    const b = new Behavior(mask);
    const on = b.update(l, 200).proboscis;
    expect(on).toBeGreaterThan(0.8);
    expect(on).toBeLessThanOrEqual(1);
    expect(b.update(l, 395).proboscis).toBeGreaterThan(0.5);
    expect(b.update(l, 700).proboscis).toBeLessThan(0.05);
  });

  it('holds the wing out while wing MNs fire, each spike is a flick that decays', () => {
    const s = train(2, 0, 20, 10); // 100 Hz
    const l = log(s.t, s.row);
    const b = new Behavior(mask);
    const atSpike = b.update(l, 100);
    expect(atSpike.wing).toBeGreaterThan(0.5);
    expect(atSpike.flick).toBeCloseTo(1);
    expect(b.update(l, 108).flick).toBeLessThan(0.2);
  });
});
