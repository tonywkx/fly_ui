import { decodeMeta, encodeMeta, type NeuronRecord, NTS, type SkeletonSet } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { buildSegments, rowBounds, SEG_STRIDE } from './segments';

const record = (bodyId: number, nt: NeuronRecord['nt'], region: string | null = null): NeuronRecord => ({
  bodyId,
  type: null,
  class: null,
  superclass: null,
  nt,
  ntConf: null,
  sign: 0,
  region,
  somaSide: null,
  maleSpecific: false,
});

// neuron 0 (bodyId 7): 0 ← 1 ← 2, plus a second root 3 ← 4. neuron 1 (bodyId 5): 0 ← 1.
const sk: SkeletonSet = {
  bodyIds: [7, 5],
  offsets: Uint32Array.from([0, 5, 7]),
  pos: Float32Array.from({ length: 21 }, (_, i) => i),
  radius: Float32Array.from([10, 11, 12, 13, 14, 20, 21]),
  parent: Int32Array.from([-1, 0, 1, -1, 3, -1, 0]),
  dist: Float32Array.from([0, 1, 2, 0, 4, 0, 6]),
};

// meta rows in a different order than the skeletons
const meta = decodeMeta(encodeMeta([record(5, 'gaba', null), record(7, 'acetylcholine', 'LO(R)')]));

const field = (seg: Float32Array, s: number, k: number) => seg[s * SEG_STRIDE + k] as number;

describe('buildSegments', () => {
  const seg = buildSegments(sk, meta);

  it('emits one segment per non-root node', () => {
    expect(seg.length / SEG_STRIDE).toBe(4);
  });

  it('spans node → local parent with path distances', () => {
    // segment 1 = node 2 (pos 6..8) → node 1 (pos 3..5)
    expect([0, 1, 2, 3].map((k) => field(seg, 1, k))).toEqual([6, 7, 8, 2]);
    expect([4, 5, 6, 7].map((k) => field(seg, 1, k))).toEqual([3, 4, 5, 1]);
    // segment 3 = neuron 1 node 1 (global 6) → its root (global 5): parents are local
    expect([0, 4, 7].map((k) => field(seg, 3, k))).toEqual([18, 15, 0]);
  });

  it('joins meta by bodyId: row index and transmitter, plus node radius', () => {
    expect([8, 9, 10].map((k) => field(seg, 0, k))).toEqual([1, NTS.indexOf('acetylcholine'), 11]);
    expect([8, 9, 10].map((k) => field(seg, 3, k))).toEqual([0, NTS.indexOf('gaba'), 21]);
  });

  it('falls back to row -1 and "unclear" for neurons absent from meta', () => {
    const lone = buildSegments(sk, decodeMeta(encodeMeta([record(5, null)])));
    expect([8, 9].map((k) => field(lone, 0, k))).toEqual([-1, NTS.indexOf('unclear')]);
    expect(field(lone, 3, 9)).toBe(NTS.indexOf('unclear'));
  });

  it('carries the region code, -1 when unknown or absent from meta', () => {
    expect(field(seg, 0, 11)).toBe(meta.strings.regions.indexOf('LO(R)'));
    expect(field(seg, 3, 11)).toBe(-1);
    const lone = buildSegments(sk, decodeMeta(encodeMeta([record(5, null, 'LO(R)')])));
    expect(field(lone, 0, 11)).toBe(-1);
  });
});

describe('rowBounds', () => {
  const b = rowBounds(buildSegments(sk, meta), 3);

  it('gives the bbox centre and half-diagonal per row', () => {
    // row 1 = bodyId 7: nodes 0..4 span (0,1,2)..(12,13,14)
    expect(Array.from(b.subarray(4, 8))).toEqual([6, 7, 8, expect.closeTo(6 * Math.sqrt(3), 5)]);
    // row 0 = bodyId 5: nodes (15,16,17)..(18,19,20)
    expect(Array.from(b.subarray(0, 4))).toEqual([16.5, 17.5, 18.5, expect.closeTo(1.5 * Math.sqrt(3), 5)]);
  });

  it('marks rows without segments with radius -1', () => {
    expect(b[11]).toBe(-1);
  });
});
