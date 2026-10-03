import { decodeMeta, encodeMeta, type NeuronRecord } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { pathHops, TraceStore } from './trace';

const record = (bodyId: number, type: string | null): NeuronRecord => ({
  bodyId,
  type,
  class: null,
  superclass: null,
  nt: null,
  ntConf: null,
  sign: 1,
  region: null,
  somaSide: null,
  maleSpecific: false,
});

const meta = decodeMeta(
  encodeMeta([record(1, 'GF'), record(2, 'LPLC2'), record(3, null), record(4, 'TTMn'), record(5, 'LPLC2')]),
);

describe('pathHops', () => {
  it('marks every row of a path type with hop + 1', () => {
    expect([...pathHops(meta, ['LPLC2', 'GF', 'TTMn'])]).toEqual([2, 1, 0, 3, 1]);
  });

  it('ignores types the scene does not have', () => {
    expect([...pathHops(meta, ['LPLC2', 'DNp06', 'TTMn'])]).toEqual([0, 1, 0, 3, 1]);
  });
});

describe('TraceStore', () => {
  it('fills From, then To; later picks replace To', () => {
    const t = new TraceStore();
    t.pick('LPLC2');
    expect(t.query).toBeNull();
    t.pick('LPLC2');
    expect(t.to).toBeNull();
    t.pick('GF');
    expect(t.query).toEqual({ from: 'LPLC2', to: 'GF' });
    t.pick('TTMn');
    expect(t.query).toEqual({ from: 'LPLC2', to: 'TTMn' });
  });

  it('swaps ends and resets the result on a new query', () => {
    const t = new TraceStore();
    t.setEnds('A', 'B');
    t.setResult([{ types: ['A', 'B'], fraction: 1, synapses: 1, hops: [] }]);
    t.setActive(0);
    expect(t.path?.types).toEqual(['A', 'B']);
    t.swap();
    expect(t.query).toEqual({ from: 'B', to: 'A' });
    expect(t.status).toBe('idle');
    expect(t.path).toBeNull();
  });

  it('keeps the active path in range', () => {
    const t = new TraceStore();
    t.setResult([{ types: ['A', 'B'], fraction: 1, synapses: 1, hops: [] }]);
    t.setActive(3);
    expect(t.active).toBe(0);
  });
});
