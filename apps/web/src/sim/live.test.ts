import { netFromEdges } from '@fly/sim';
import { describe, expect, it } from 'vitest';
import { Live, rowMap } from './live';

describe('rowMap', () => {
  it('maps full rows to scenario rows by bodyId, −1 outside', () => {
    const map = rowMap(Float64Array.from([10, 20, 30, 40]), Float64Array.from([30, 10]));
    expect([...map.rowOf]).toEqual([1, -1, 0, -1]);
    expect([...map.fullOf]).toEqual([2, 0]);
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
});
