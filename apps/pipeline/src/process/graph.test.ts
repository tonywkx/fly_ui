import type { NeuronRecord } from '@fly/data';
import { describe, expect, test } from 'vitest';
import type { RawNeuron } from '../fetch/graph';
import { buildGraph, ntSign, orderNeurons, subgraph, toRecord } from './graph';

const raw = (bodyId: number, over: Partial<RawNeuron> = {}): RawNeuron => ({
  bodyId,
  type: null,
  class: null,
  superclass: null,
  nt: 'acetylcholine',
  ntConf: 0.9,
  somaSide: null,
  fruDsx: null,
  region: null,
  ...over,
});

describe('ntSign', () => {
  const s = (nt: NeuronRecord['nt'], ntConf: number | null = 0.9, superclass: string | null = null) =>
    ntSign({ nt, ntConf, superclass });
  test('ACh +, GABA/Glu/His −, modulators and unclear 0', () => {
    expect([s('acetylcholine'), s('gaba'), s('glutamate'), s('histamine')]).toEqual([1, -1, -1, -1]);
    expect([s('dopamine'), s('serotonin'), s('octopamine'), s('unclear'), s(null)]).toEqual([0, 0, 0, 0, 0]);
  });
  test('confidence below 0.6 or missing → 0; motor neurons → 0', () => {
    expect([s('gaba', 0.59), s('gaba', 0.6), s('gaba', null)]).toEqual([0, -1, 0]);
    expect([s('acetylcholine', 0.9, 'vnc_motor'), s('glutamate', 0.9, 'cb_motor')]).toEqual([0, 0]);
  });
});

describe('toRecord', () => {
  test('normalizes nt, somaSide, maleSpecific and derives sign', () => {
    expect(toRecord(raw(1, { nt: 'weird', somaSide: 'RHS', fruDsx: 'fru_low' }))).toMatchObject({
      nt: 'unclear',
      sign: 0,
      somaSide: null,
      maleSpecific: false,
    });
    expect(toRecord(raw(2, { nt: 'gaba', somaSide: 'M', fruDsx: 'dsx_high' }))).toMatchObject({
      nt: 'gaba',
      sign: -1,
      somaSide: 'M',
      maleSpecific: true,
    });
    expect(toRecord(raw(3, { nt: null, ntConf: 0.9 }))).toMatchObject({ nt: null, ntConf: null, sign: 0 });
  });
});

describe('graph build', () => {
  const meta = orderNeurons([
    toRecord(raw(30, { type: 'B' })),
    toRecord(raw(10)),
    toRecord(raw(20, { type: 'A' })),
    toRecord(raw(40, { type: 'A' })),
  ]);

  test('orders by type (untyped last), then bodyId', () => {
    expect(meta.map((r) => r.bodyId)).toEqual([20, 40, 30, 10]);
  });

  test('maps bodyIds to rows; drops edges to unknown bodies', () => {
    const g = buildGraph(meta, [
      { pre: [10, 20], post: [20, 30], w: [5, 6] },
      { pre: [30, 99], post: [10, 10], w: [7, 8] },
    ]);
    expect(g.dropped).toBe(1);
    expect(Array.from(g.csr.offsets)).toEqual([0, 1, 1, 2, 3]);
    expect(Array.from(g.csr.cols)).toEqual([2, 3, 0]);
    expect(Array.from(g.csr.weight)).toEqual([6, 7, 5]);
  });

  test('induced subgraph keeps row order and only internal edges', () => {
    const g = buildGraph(meta, [{ pre: [10, 20, 30, 40], post: [20, 30, 10, 10], w: [5, 6, 7, 9] }]);
    const sub = subgraph(g, [10, 30, 40]);
    expect(sub.meta.map((r) => r.bodyId)).toEqual([40, 30, 10]);
    expect(Array.from(sub.csr.offsets)).toEqual([0, 1, 2, 2]);
    expect(Array.from(sub.csr.cols)).toEqual([2, 2]);
    expect(Array.from(sub.csr.weight)).toEqual([9, 7]);
  });
});
