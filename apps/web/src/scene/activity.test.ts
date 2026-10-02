import { type Csr, csrFromEdges, decodeMeta, encodeMeta, type NeuronRecord } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { bfsOnsets, cycleMs, NEVER, seedRows, writeSpikes } from './activity';

const csr = (n: number, edges: [number, number, number?][]): Csr =>
  csrFromEdges(
    n,
    edges.map((e) => e[0]),
    edges.map((e) => e[1]),
    edges.map((e) => e[2] ?? 1),
  );

describe('bfsOnsets', () => {
  it('delays each hop along a chain', () => {
    expect([
      ...bfsOnsets(
        csr(3, [
          [0, 1],
          [1, 2],
        ]),
        [0],
        5,
      ),
    ]).toEqual([0, 5, 10]);
  });

  it('takes the shortest path and survives cycles', () => {
    // 0→1→2→3, 0→3, 3→0
    const g = csr(4, [
      [0, 1],
      [1, 2],
      [2, 3],
      [0, 3],
      [3, 0],
    ]);
    expect([...bfsOnsets(g, [0], 2)]).toEqual([0, 2, 4, 2]);
  });

  it('leaves unreachable rows at Infinity', () => {
    expect([...bfsOnsets(csr(3, [[1, 2]]), [0], 1)]).toEqual([0, Infinity, Infinity]);
  });

  it('starts every seed at 0', () => {
    const g = csr(4, [
      [0, 2],
      [1, 3],
      [2, 3],
    ]);
    expect([...bfsOnsets(g, [0, 1], 3)]).toEqual([0, 0, 3, 3]);
  });

  it('ignores edges below minWeight', () => {
    const g = csr(3, [
      [0, 1, 2],
      [0, 2, 9],
    ]);
    expect([...bfsOnsets(g, [0], 1, 5)]).toEqual([0, Infinity, 1]);
  });
});

const record = (bodyId: number, type: string | null): NeuronRecord => ({
  bodyId,
  type,
  class: null,
  superclass: null,
  nt: null,
  ntConf: null,
  sign: 0,
  region: null,
  somaSide: null,
  maleSpecific: false,
});

describe('seedRows', () => {
  it('returns the rows of the given types', () => {
    const meta = decodeMeta(
      encodeMeta([record(1, 'LC4'), record(2, 'GF'), record(3, null), record(4, 'LPLC2')]),
    );
    expect(seedRows(meta, ['LPLC2', 'LC4', 'nope'])).toEqual([0, 3]);
  });
});

describe('cycleMs', () => {
  it('is the latest finite onset plus the tail', () => {
    expect(cycleMs(Float32Array.from([0, 12, Infinity, 7]), 40)).toBe(52);
  });
});

describe('writeSpikes', () => {
  it('fires rows whose onset has passed and reports changes', () => {
    const on = Float32Array.from([0, 5, Infinity]);
    const out = new Float32Array(4).fill(NEVER);
    expect(writeSpikes(on, 3, out)).toBe(true);
    expect([...out]).toEqual([0, NEVER, NEVER, NEVER]);
    expect(writeSpikes(on, 4, out)).toBe(false);
    expect(writeSpikes(on, 5, out)).toBe(true);
    expect([...out]).toEqual([0, 5, NEVER, NEVER]);
    // rewinding (loop restart) clears the later spikes again
    expect(writeSpikes(on, 1, out)).toBe(true);
    expect([...out]).toEqual([0, NEVER, NEVER, NEVER]);
  });
});
