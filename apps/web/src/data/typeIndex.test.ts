import { decodeMeta, encodeMeta, type NeuronRecord } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { findBodyIds, typeIndex } from './typeIndex';

const record = (bodyId: number, type: string | null, superclass: string | null = null): NeuronRecord => ({
  bodyId,
  type,
  class: null,
  superclass,
  nt: null,
  ntConf: null,
  sign: 0,
  region: null,
  somaSide: null,
  maleSpecific: false,
});

const meta = decodeMeta(
  encodeMeta([
    record(10001, 'GF', 'descending_neuron'),
    record(20450, 'LC4', 'visual_projection'),
    record(20451, 'LC4', 'visual_projection'),
    record(30000, null),
    record(10002, 'GF', 'descending_neuron'),
    record(40000, 'aSP-g'),
  ]),
);

describe('typeIndex', () => {
  it('groups rows by cell type, sorted by name ignoring case; untyped rows left out', () => {
    expect(typeIndex(meta)).toEqual([
      { type: 'aSP-g', rows: [5], superclass: null },
      { type: 'GF', rows: [0, 4], superclass: 'descending_neuron' },
      { type: 'LC4', rows: [1, 2], superclass: 'visual_projection' },
    ]);
  });
});

describe('findBodyIds', () => {
  it('finds rows whose bodyId starts with the digits, up to a limit', () => {
    expect(findBodyIds(meta, '1000', 8)).toEqual([0, 4]);
    expect(findBodyIds(meta, '2045', 1)).toEqual([1]);
    expect(findBodyIds(meta, '30000', 8)).toEqual([3]);
    expect(findBodyIds(meta, '9', 8)).toEqual([]);
  });

  it('ignores non-digit queries', () => {
    expect(findBodyIds(meta, 'GF', 8)).toEqual([]);
    expect(findBodyIds(meta, '', 8)).toEqual([]);
  });
});
