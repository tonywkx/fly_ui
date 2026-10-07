import { netFromEdges } from '@fly/sim';
import { describe, expect, it } from 'vitest';
import { Live, rowMap, watchMap, watchRows } from './live';

describe('rowMap', () => {
  it('maps full rows to scenario rows by bodyId, −1 outside', () => {
    const map = rowMap(Float64Array.from([10, 20, 30, 40]), Float64Array.from([30, 10]));
    expect([...map.rowOf]).toEqual([1, -1, 0, -1]);
    expect([...map.fullOf]).toEqual([2, 0]);
  });
});

describe('watch', () => {
  it('watchMap reports the given full rows as 0…k−1', () => {
    const m = watchMap(5, Uint32Array.of(1, 4));
    expect([...m.rowOf]).toEqual([-1, 0, -1, -1, 1]);
    expect([...m.fullOf]).toEqual([1, 4]);
  });

  it('watchRows unions groups and re-indexes them', () => {
    const u = (...x: number[]) => Uint32Array.from(x);
    const { rows, local } = watchRows({
      a: { all: u(7, 3), L: u(3), R: u(7) },
      b: { all: u(3, 9), L: u(), R: u() },
    });
    expect([...rows]).toEqual([3, 7, 9]);
    expect([...local.a.all]).toEqual([1, 0]);
    expect([...local.a.R]).toEqual([1]);
    expect([...local.b.all]).toEqual([0, 2]);
  });
});

/** full 0 → 1 → 2 → 3; the scenario sees only full rows 1 and 3 (as rows 0 and 1). */
const setup = () => {
  const net = netFromEdges(4, [
    [0, 1, 60],
    [1, 2, 60],
    [2, 3, 60],
  ]);
  const rows = rowMap(Float64Array.from([1, 2, 3, 4]), Float64Array.from([2, 4]));
  return new Live(net, rows, { seed: 1 });
};

describe('Live', () => {
  it('returns only scenario spikes, time-ordered, with the horizon', () => {
    const live = setup();
    live.inject(0, 60);
    const b = live.advance(20);
    expect([...b.row]).toEqual([0, 1]);
    expect(b.t[0]).toBeLessThan(b.t[1] as number);
    expect(b.until).toBeCloseTo(20);
    expect(b.total).toBe(3); // full rows 1, 2, 3
    expect(live.advance(10).row.length).toBe(0);
  });

  it('stimulates and silences by scenario row', () => {
    const live = setup();
    live.stimulate(0);
    live.silence(1);
    const b = live.advance(100);
    expect(b.row.length).toBeGreaterThan(5);
    expect([...b.row].every((r) => r === 0)).toBe(true);
  });

  it('reset restarts from rest with the same seed', () => {
    const live = setup();
    live.stimulate(0);
    const a = live.advance(50);
    live.reset();
    live.stimulate(0);
    const b = live.advance(50);
    expect([...b.t]).toEqual([...a.t]);
    expect(b.until).toBeCloseTo(50);
  });

  it('retune restarts at t = 0 with the new params', () => {
    const live = setup();
    live.inject(0, 60);
    expect(live.advance(20).row.length).toBe(2);
    live.retune({ vThreshold: 100 });
    live.inject(0, 60);
    const b = live.advance(20);
    expect(b.until).toBeCloseTo(20);
    expect(b.total).toBe(0);
  });

  it('retune swaps the net', () => {
    const live = setup();
    live.retune({}, netFromEdges(4, [[1, 2, 60]]));
    live.inject(0, 60);
    const b = live.advance(20);
    expect([...b.row]).toEqual([0]); // full 2 is not a scenario row, 2 → 3 is gone
    expect(b.total).toBe(2);
  });

  it('drives and silences by full row; drive 0 Hz removes it', () => {
    const live = setup();
    live.drive({ rows: Uint32Array.of(1), hz: Float32Array.of(150) });
    live.silenceRows(Uint32Array.of(3));
    const b = live.advance(100);
    expect(b.row.length).toBeGreaterThan(5);
    expect([...b.row].every((r) => r === 0)).toBe(true);
    live.drive({ rows: Uint32Array.of(1), hz: Float32Array.of(0) });
    live.advance(10);
    expect(live.advance(100).total).toBe(0);
  });

  it('watch switches the reported rows mid-run', () => {
    const live = setup();
    live.watch(Uint32Array.of(2));
    live.inject(0, 60); // scenario row 0 is now full row 2
    const b = live.advance(20);
    expect([...b.row]).toEqual([0]);
    expect(b.total).toBe(2); // full 2 → 3
  });
});
