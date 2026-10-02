import { describe, expect, test } from 'vitest';
import { decodeChunk, encodeChunk } from './container';
import { type Csr, csrFromEdges, decodeGraph, encodeGraph } from './graph';

const csr = (offsets: number[], cols: number[], weight: number[]): Csr => ({
  offsets: Uint32Array.from(offsets),
  cols: Uint32Array.from(cols),
  weight: Uint16Array.from(weight),
});

describe('csrFromEdges', () => {
  test('groups by pre, sorts cols, keeps empty rows', () => {
    const g = csrFromEdges(4, [2, 0, 2, 0], [1, 3, 0, 1], [7, 5, 9, 6]);
    expect(Array.from(g.offsets)).toEqual([0, 2, 2, 4, 4]);
    expect(Array.from(g.cols)).toEqual([1, 3, 0, 1]);
    expect(Array.from(g.weight)).toEqual([6, 5, 9, 7]);
  });

  test('sums duplicate edges and clamps weight to u16', () => {
    const g = csrFromEdges(2, [0, 0, 1], [1, 1, 0], [40000, 40000, 70000]);
    expect(Array.from(g.cols)).toEqual([1, 0]);
    expect(Array.from(g.weight)).toEqual([65535, 65535]);
  });

  test('rejects out-of-range indices and length mismatch', () => {
    expect(() => csrFromEdges(2, [0], [2], [1])).toThrow(/out of range/);
    expect(() => csrFromEdges(2, [0, 1], [1], [1])).toThrow(/length/);
  });
});

describe('graph codec', () => {
  test('roundtrip restores absolute cols', () => {
    const g = csr([0, 3, 3, 5], [0, 1, 2, 0, 2], [5, 6, 7, 8, 9]);
    const d = decodeGraph(encodeGraph(g));
    expect(Array.from(d.offsets)).toEqual([0, 3, 3, 5]);
    expect(Array.from(d.cols)).toEqual([0, 1, 2, 0, 2]);
    expect(Array.from(d.weight)).toEqual([5, 6, 7, 8, 9]);
    expect(d.cols).toBeInstanceOf(Uint32Array);
  });

  test('stores cols delta-coded within each row', () => {
    const offsets = [0, 3, ...Array<number>(1000).fill(5)]; // n = 1001
    const g = csr(offsets, [10, 11, 15, 1, 1000], [1, 1, 1, 1, 1]);
    const deltas = decodeChunk(encodeGraph(g)).sections[1];
    expect(Array.from(deltas as Uint32Array)).toEqual([10, 1, 4, 1, 999]);
  });

  test('empty graph', () => {
    const d = decodeGraph(encodeGraph(csr([0], [], [])));
    expect(d.offsets.length).toBe(1);
    expect(d.cols.length).toBe(0);
  });

  test('encoder rejects unsorted or duplicate cols and bad offsets', () => {
    expect(() => encodeGraph(csr([0, 2], [0, 0], [1, 1]))).toThrow(/sorted/);
    expect(() => encodeGraph(csr([0, 2, 2], [1, 0], [1, 1]))).toThrow(/sorted/);
    expect(() => encodeGraph(csr([0, 3], [0], [1]))).toThrow(/offsets/);
    expect(() => encodeGraph(csr([0, 1], [5], [1]))).toThrow(/out of range/);
  });

  test('decoder rejects wrong kind and layout', () => {
    expect(() => decodeGraph(encodeChunk('cloud', [new Uint16Array(3)]))).toThrow(/expected graph/);
    expect(() => decodeGraph(encodeChunk('graph', [new Uint16Array(3)]))).toThrow(/layout/);
  });
});
