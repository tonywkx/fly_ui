import { describe, expect, test } from 'vitest';
import { encodeChunk } from './container';
import { decodeNeuropils, encodeNeuropils, type NamedMesh } from './neuropil';
import type { BBox } from './skeleton';

const bbox: BBox = { min: [0, 0, 0], max: [1000, 2000, 3000] };
const tri: NamedMesh = {
  name: 'AB(L)',
  pos: new Float32Array([0, 0, 0, 1000, 0, 0, 0, 2000, 3000]),
  index: new Uint32Array([0, 1, 2]),
};
const quad: NamedMesh = {
  name: "a'L(R)",
  pos: new Float32Array([10, 10, 10, 500, 10, 10, 500, 700, 10, 10, 700, 2999]),
  index: new Uint32Array([0, 1, 2, 0, 2, 3]),
};

describe('neuropil codec', () => {
  test('roundtrip: names, ranges, global indices, positions within one quantization step', () => {
    const d = decodeNeuropils(encodeNeuropils([tri, quad], bbox), bbox);
    expect(d.ranges).toEqual([
      { name: 'AB(L)', vertStart: 0, vertCount: 3, indexStart: 0, indexCount: 3 },
      { name: "a'L(R)", vertStart: 3, vertCount: 4, indexStart: 3, indexCount: 6 },
    ]);
    expect(Array.from(d.index)).toEqual([0, 1, 2, 3, 4, 5, 3, 5, 6]);
    expect(d.index).toBeInstanceOf(Uint32Array);
    const src = [...tri.pos, ...quad.pos];
    expect(d.pos.length).toBe(src.length);
    src.forEach((v, i) => {
      const span = (bbox.max[i % 3] as number) - (bbox.min[i % 3] as number);
      expect(Math.abs((d.pos[i] as number) - v)).toBeLessThanOrEqual(span / 65535);
    });
  });

  test('empty list roundtrips', () => {
    const d = decodeNeuropils(encodeNeuropils([], bbox), bbox);
    expect(d.ranges).toEqual([]);
    expect(d.pos.length).toBe(0);
    expect(d.index.length).toBe(0);
  });

  test('mesh with more than 65535 vertices is rejected', () => {
    const big: NamedMesh = {
      name: 'big',
      pos: new Float32Array(65536 * 3),
      index: new Uint32Array([0, 1, 65535]),
    };
    expect(() => encodeNeuropils([big], bbox)).toThrow(/65535/);
  });

  test('index out of the mesh vertex range is rejected', () => {
    expect(() => encodeNeuropils([{ ...tri, index: new Uint32Array([0, 1, 3]) }], bbox)).toThrow(/index/);
  });

  test('wrong chunk kind throws', () => {
    expect(() => decodeNeuropils(encodeChunk('cloud', [new Uint16Array(3)]), bbox)).toThrow(/neuropil/);
  });
});
