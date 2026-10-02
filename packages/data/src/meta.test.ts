import { describe, expect, test } from 'vitest';
import { encodeChunk } from './container';
import { decodeMeta, encodeMeta, type NeuronRecord, NONE16, neuronAt } from './meta';

const gf: NeuronRecord = {
  bodyId: 10093,
  type: 'DNp01',
  class: null,
  superclass: 'descending_neuron',
  nt: 'acetylcholine',
  ntConf: 0.53,
  sign: 0,
  region: 'GNG',
  somaSide: 'R',
  maleSpecific: false,
};
const p1: NeuronRecord = {
  bodyId: 2 ** 40 + 7,
  type: 'pC1_14a',
  class: 'cb_intrinsic',
  superclass: 'cb_intrinsic',
  nt: 'gaba',
  ntConf: 1,
  sign: -1,
  region: 'SMP(L)',
  somaSide: 'L',
  maleSpecific: true,
};
const blank: NeuronRecord = {
  bodyId: 1,
  type: null,
  class: null,
  superclass: null,
  nt: null,
  ntConf: null,
  sign: 0,
  region: null,
  somaSide: null,
  maleSpecific: false,
};

describe('meta codec', () => {
  test('roundtrip, ntConf within one u8 step, null fields', () => {
    const t = decodeMeta(encodeMeta([gf, p1, blank, { ...gf, bodyId: 10094, somaSide: 'L' }]));
    expect(t.n).toBe(4);
    const back = [0, 1, 2, 3].map((i) => neuronAt(t, i));
    expect(back[2]).toEqual(blank);
    expect(back[1]).toEqual({ ...p1, ntConf: 1 });
    expect(back[0]?.ntConf).toBeCloseTo(0.53, 2);
    expect({ ...back[0], ntConf: 0 }).toEqual({ ...gf, ntConf: 0 });
    expect(back[3]?.bodyId).toBe(10094);
  });

  test('string tables are deduplicated; absent type is NONE16', () => {
    const t = decodeMeta(encodeMeta([gf, { ...gf, bodyId: 2 }, blank]));
    expect(t.strings.types).toEqual(['DNp01']);
    expect(Array.from(t.type)).toEqual([0, 0, NONE16]);
    expect(t.bodyIds).toEqual(new Float64Array([10093, 2, 1]));
  });

  test('sign is stored independently of nt', () => {
    const t = decodeMeta(encodeMeta([{ ...p1, sign: 1 }]));
    expect(t.sign[0]).toBe(1);
  });

  test('rejects u8 dictionary overflow', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ ...blank, bodyId: i, class: `c${i}` }));
    expect(() => encodeMeta(many)).toThrow(/class/);
  });

  test('decoder rejects wrong kind and layout', () => {
    expect(() => decodeMeta(encodeChunk('graph', [new Uint32Array(1)]))).toThrow(/expected meta/);
    expect(() => decodeMeta(encodeChunk('meta', [new Uint32Array(1)]))).toThrow(/layout/);
  });
});
