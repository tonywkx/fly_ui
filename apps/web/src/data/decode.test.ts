import {
  type BBox,
  csrFromEdges,
  encodeCloud,
  encodeGraph,
  encodeMeta,
  encodeNeuropils,
  encodeSkeletons,
} from '@fly/data';
import { describe, expect, it } from 'vitest';
import { decodeByKind, transferables } from './decode';

const bbox: BBox = { min: [0, 0, 0], max: [100, 100, 100] };

describe('decodeByKind', () => {
  it('dispatches on the chunk kind', () => {
    const cloud = decodeByKind('cloud', encodeCloud(new Float32Array([0, 50, 100]), bbox), bbox);
    expect(cloud.kind).toBe('cloud');
    if (cloud.kind === 'cloud') expect(cloud.data[1]).toBeCloseTo(50, 0);

    const mesh = {
      name: 'CV',
      pos: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      index: new Uint32Array([0, 1, 2]),
    };
    const np = decodeByKind('neuropil', encodeNeuropils([mesh], bbox), bbox);
    expect(np.kind === 'neuropil' && np.data.ranges[0]?.name).toBe('CV');

    const skeleton = {
      pos: new Float32Array([10, 10, 10, 20, 20, 20]),
      radius: new Float32Array([5, 2]),
      parent: new Int32Array([-1, 0]),
      type: new Uint8Array([1, 3]),
      soma: 0,
    };
    const sk = decodeByKind('skeletons', encodeSkeletons([{ bodyId: 7, skeleton }], bbox), bbox);
    expect(sk.kind === 'skeletons' && sk.data.bodyIds).toEqual([7]);

    const g = decodeByKind('graph', encodeGraph(csrFromEdges(2, [0], [1], [9])), bbox);
    expect(g.kind === 'graph' && Array.from(g.data.weight)).toEqual([9]);

    const row = {
      bodyId: 1,
      type: 'DNp01',
      class: null,
      superclass: null,
      nt: null,
      ntConf: null,
      sign: 0 as const,
      region: null,
      somaSide: null,
      maleSpecific: false,
    };
    const m = decodeByKind('meta', encodeMeta([row]), bbox);
    expect(m.kind === 'meta' && m.data.strings.types).toEqual(['DNp01']);
  });

  it('rejects a chunk whose kind differs from the manifest', () => {
    expect(() => decodeByKind('graph', encodeCloud(new Float32Array(3), bbox), bbox)).toThrow(/graph/);
  });
});

describe('transferables', () => {
  it('collects each typed-array buffer once, deep', () => {
    const a = new Float32Array(4);
    const b = new Uint16Array(a.buffer, 0, 2);
    const c = new Int8Array(2);
    expect(transferables({ a, nested: { b, list: [c] }, s: 'x' })).toEqual([a.buffer, c.buffer]);
  });
});
