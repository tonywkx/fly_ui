import type { TypeGraph } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { inputTotals, kBestPaths, preparePaths } from './paths';

/** Type graph from [pre, post, weight] edges (cols sorted per row, as the decoder yields). */
function typeGraph(names: string[], edges: [number, number, number][]): TypeGraph {
  const n = names.length;
  const sorted = [...edges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const offsets = new Uint32Array(n + 1);
  for (const [a] of sorted) offsets[a + 1] = (offsets[a + 1] as number) + 1;
  for (let k = 0; k < n; k++) offsets[k + 1] = (offsets[k + 1] as number) + (offsets[k] as number);
  return {
    names,
    count: new Uint32Array(n).fill(1),
    offsets,
    cols: Uint32Array.from(sorted.map((e) => e[1])),
    weight: Uint32Array.from(sorted.map((e) => e[2])),
    signed: Int32Array.from(sorted.map((e) => e[2])),
  };
}

const [A, B, C, D, E] = [0, 1, 2, 3, 4];
// Inputs: B ← A 50 (self-loop B→B ignored) · C ← A 20, B 10 · D ← B 30, C 60, A 5, E 100 · A ← D 100.
const g = typeGraph(
  ['A', 'B', 'C', 'D', 'E'],
  [
    [A, B, 50],
    [A, C, 20],
    [A, D, 5],
    [B, B, 40],
    [B, C, 10],
    [B, D, 30],
    [C, D, 60],
    [D, A, 100],
    [E, D, 100],
  ],
);
const p = preparePaths(g);
const types = (paths: { types: number[] }[]) => paths.map((x) => x.types);

describe('inputTotals', () => {
  it('sums incoming weight per type, without self-loops', () => {
    expect([...inputTotals(g)]).toEqual([100, 50, 30, 195, 0]);
  });
});

describe('kBestPaths', () => {
  it('ranks simple paths by the product of input fractions', () => {
    const paths = kBestPaths(p, A, D, { k: 10, maxHops: 6 });
    // A→C→D 2/3·60/195 > A→B→D 1·30/195 > A→B→C→D 1·1/3·60/195 > A→D 5/195
    expect(types(paths)).toEqual([
      [A, C, D],
      [A, B, D],
      [A, B, C, D],
      [A, D],
    ]);
    expect(paths[0]?.fraction).toBeCloseTo((20 / 30) * (60 / 195));
    expect(paths[0]?.synapses).toBe(80);
    expect(paths[0]?.hops).toEqual([
      { w: 20, frac: expect.closeTo(20 / 30) },
      { w: 60, frac: expect.closeTo(60 / 195) },
    ]);
  });

  it('stops at k', () => {
    expect(types(kBestPaths(p, A, D, { k: 2, maxHops: 6 }))).toEqual([
      [A, C, D],
      [A, B, D],
    ]);
  });

  it('respects the hop limit', () => {
    expect(types(kBestPaths(p, A, D, { k: 10, maxHops: 1 }))).toEqual([[A, D]]);
    expect(types(kBestPaths(p, A, D, { k: 10, maxHops: 2 }))).toEqual([
      [A, C, D],
      [A, B, D],
      [A, D],
    ]);
  });

  it('routes only through allowed types (ends always allowed)', () => {
    const allowed = Uint8Array.from([0, 1, 0, 0, 0]);
    expect(types(kBestPaths(p, A, D, { k: 10, maxHops: 6, allowed }))).toEqual([
      [A, B, D],
      [A, D],
    ]);
  });

  it('never revisits a type', () => {
    for (const path of kBestPaths(p, B, A, { k: 10, maxHops: 6 }))
      expect(new Set(path.types).size).toBe(path.types.length);
  });

  it('returns nothing when there is no path or src = dst', () => {
    expect(kBestPaths(p, D, E, { k: 5, maxHops: 6 })).toEqual([]);
    expect(kBestPaths(p, A, A, { k: 5, maxHops: 6 })).toEqual([]);
  });
});
