import { describe, expect, test } from 'vitest';
import { encodeChunk } from './container';
import { csrFromEdges } from './graph';
import { NONE16 } from './meta';
import {
  collapseByType,
  decodeTypeGraph,
  encodeTypeGraph,
  pruneTypeGraph,
  type TypeGraph,
} from './typegraph';

// neurons: 0,1 → type A (signs +1, -1); 2 → type B (sign 0); 3 → untyped (+1); 4 → type B (+1)
const meta = {
  type: Uint16Array.from([0, 0, 1, NONE16, 1]),
  sign: Int8Array.from([1, -1, 0, 1, 1]),
  strings: { types: ['A', 'B'], classes: [], superclasses: [], regions: [] },
};

describe('collapseByType', () => {
  const csr = csrFromEdges(5, [0, 1, 0, 2, 3, 4, 4], [2, 4, 1, 0, 0, 2, 3], [10, 4, 3, 7, 50, 6, 9]);
  const g = collapseByType(csr, meta);

  test('nodes follow meta type order with neuron counts', () => {
    expect(g.names).toEqual(['A', 'B']);
    expect(Array.from(g.count)).toEqual([2, 2]);
  });

  test('sums weights and signed weights per type pair, keeps self-loops, skips untyped', () => {
    // A→A: 0→1 (3, +3); A→B: 0→2 (10, +10), 1→4 (4, -4); B→A: 2→0 (7, 0); B→B: 4→2 (6, +6)
    expect(Array.from(g.offsets)).toEqual([0, 2, 4]);
    expect(Array.from(g.cols)).toEqual([0, 1, 0, 1]);
    expect(Array.from(g.weight)).toEqual([3, 14, 7, 6]);
    expect(Array.from(g.signed)).toEqual([3, 6, 0, 6]);
  });

  test('weights exceed u16', () => {
    const big = csrFromEdges(2, [0, 1], [1, 0], [60000, 60000]);
    const t = collapseByType(big, {
      type: Uint16Array.from([0, 0]),
      sign: Int8Array.from([-1, -1]),
      strings: meta.strings,
    });
    expect(Array.from(t.weight)).toEqual([120000]);
    expect(Array.from(t.signed)).toEqual([-120000]);
  });
});

const tg = (): TypeGraph => ({
  names: ['A', 'B', 'C'],
  count: Uint32Array.from([3, 1, 2]),
  offsets: Uint32Array.from([0, 2, 2, 3]),
  cols: Uint32Array.from([0, 2, 1]),
  weight: Uint32Array.from([5, 100000, 7]),
  signed: Int32Array.from([-5, 100000, 0]),
});

describe('typegraph codec', () => {
  test('roundtrip', () => {
    const d = decodeTypeGraph(encodeTypeGraph(tg()));
    expect(d.names).toEqual(['A', 'B', 'C']);
    expect(Array.from(d.count)).toEqual([3, 1, 2]);
    expect(Array.from(d.offsets)).toEqual([0, 2, 2, 3]);
    expect(Array.from(d.cols)).toEqual([0, 2, 1]);
    expect(Array.from(d.weight)).toEqual([5, 100000, 7]);
    expect(Array.from(d.signed)).toEqual([-5, 100000, 0]);
    expect(d.signed).toBeInstanceOf(Int32Array);
  });

  test('rejects invalid graphs', () => {
    expect(() => encodeTypeGraph({ ...tg(), cols: Uint32Array.from([2, 0, 1]) })).toThrow(/sorted/);
    expect(() => encodeTypeGraph({ ...tg(), cols: Uint32Array.from([0, 3, 1]) })).toThrow(/range/);
    expect(() => encodeTypeGraph({ ...tg(), signed: Int32Array.from([1]) })).toThrow(/match/);
    expect(() => encodeTypeGraph({ ...tg(), names: ['A'] })).toThrow(/names/);
  });

  test('rejects other chunk kinds', () => {
    expect(() => decodeTypeGraph(encodeChunk('graph', [new Uint32Array(1)]))).toThrow(/typegraph/);
  });
});

describe('pruneTypeGraph', () => {
  test('keeps edges with weight >= min, rebuilds offsets, keeps nodes', () => {
    const p = pruneTypeGraph(tg(), 7);
    expect(p.names).toEqual(['A', 'B', 'C']);
    expect(Array.from(p.count)).toEqual([3, 1, 2]);
    expect(Array.from(p.offsets)).toEqual([0, 1, 1, 2]);
    expect(Array.from(p.cols)).toEqual([2, 1]);
    expect(Array.from(p.weight)).toEqual([100000, 7]);
    expect(Array.from(p.signed)).toEqual([100000, 0]);
    expect(() => encodeTypeGraph(p)).not.toThrow();
  });

  test('threshold above every weight leaves empty rows; min 0 keeps all', () => {
    const p = pruneTypeGraph(tg(), 1e9);
    expect(Array.from(p.offsets)).toEqual([0, 0, 0, 0]);
    expect(p.cols.length).toBe(0);
    expect(Array.from(pruneTypeGraph(tg(), 0).cols)).toEqual([0, 2, 1]);
  });
});
