import { describe, expect, test } from 'vitest';
import { decodeChunk, encodeChunk, type Section } from './container';
import { FORMAT_VERSION } from './manifest';

const sections = () => [
  new Float32Array([1.5, -2.25, 3]),
  new Uint16Array([0, 65535, 7]),
  new Uint32Array([4_000_000_000, 1]),
  new Int8Array([-1, 0, 1, 127, -128]),
  new Uint8Array([9]),
  new Int32Array([-5, 5]),
  new Int16Array([-300]),
  new Uint8Array(0),
];

describe('chunk container', () => {
  test('roundtrips kind and typed sections', () => {
    const input = sections();
    const { kind, sections: out } = decodeChunk(encodeChunk('skeletons', input));
    expect(kind).toBe('skeletons');
    const shape = (xs: Section[]) => xs.map((x) => [x.constructor, Array.from(x)]);
    expect(shape(out)).toEqual(shape(input));
  });

  test('sections are 4-byte aligned zero-copy views', () => {
    const buf = encodeChunk('graph', sections());
    expect(buf.byteLength % 4).toBe(0);
    for (const s of decodeChunk(buf).sections) {
      expect(s.buffer).toBe(buf.buffer);
      expect(s.byteOffset % 4).toBe(0);
    }
  });

  test('accepts a bare ArrayBuffer', () => {
    const buf = encodeChunk('meta', [new Uint32Array([42])]);
    const { sections: out } = decodeChunk(buf.buffer as ArrayBuffer);
    expect(Array.from(out[0] ?? [])).toEqual([42]);
  });

  test('copies when input is misaligned', () => {
    const buf = encodeChunk('cloud', [new Float32Array([1, 2])]);
    const shifted = new Uint8Array(buf.byteLength + 1).subarray(1);
    shifted.set(buf);
    expect(Array.from(decodeChunk(shifted).sections[0] ?? [])).toEqual([1, 2]);
  });

  test('rejects bad magic', () => {
    const buf = encodeChunk('meta', []);
    buf[0] = 0;
    expect(() => decodeChunk(buf)).toThrow(/magic/);
  });

  test('rejects other format version', () => {
    const buf = encodeChunk('meta', []);
    new DataView(buf.buffer).setUint16(4, FORMAT_VERSION + 1, true);
    expect(() => decodeChunk(buf)).toThrow(/version/);
  });

  test('rejects truncated data', () => {
    const buf = encodeChunk('meta', [new Uint32Array([1, 2, 3])]);
    expect(() => decodeChunk(buf.subarray(0, buf.byteLength - 4))).toThrow(/truncated/);
  });
});
