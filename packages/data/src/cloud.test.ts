import { describe, expect, test } from 'vitest';
import { bboxOf, bboxUnion, decodeCloud, encodeCloud, lodTiers, mulberry32, sampleCable } from './cloud';
import { encodeChunk } from './container';
import type { BBox } from './skeleton';
import { parseSwc } from './swc';

const swc = (...rows: string[]) => parseSwc(rows.join('\n'));
const triplets = (p: Float32Array) =>
  Array.from({ length: p.length / 3 }, (_, i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]] as number[]);

describe('mulberry32', () => {
  test('same seed, same stream; values in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('sampleCable', () => {
  // two edges along x: 0 -> 50 -> 100
  const line = () => swc('1 1 0 0 0 5 -1', '2 0 50 0 0 1 1', '3 0 100 0 0 1 2');

  test('expected count ≈ cable length / spacing, all points on the cable', () => {
    let total = 0;
    const rand = mulberry32(7);
    for (let run = 0; run < 200; run++) {
      const p = sampleCable(line(), 10, rand);
      total += p.length / 3;
      for (const [x, y, z] of triplets(p)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBe(0);
        expect(z).toBe(0);
      }
    }
    expect(total / 200).toBeGreaterThan(9.5);
    expect(total / 200).toBeLessThan(10.5);
  });

  test('deterministic for the same seed', () => {
    expect(Array.from(sampleCable(line(), 3, mulberry32(1)))).toEqual(
      Array.from(sampleCable(line(), 3, mulberry32(1))),
    );
  });

  test('roots contribute no edge; huge spacing yields at most one point per edge', () => {
    expect(sampleCable(swc('1 1 0 0 0 5 -1'), 1, mulberry32(1)).length).toBe(0);
    expect(sampleCable(line(), 1e6, mulberry32(1)).length / 3).toBeLessThanOrEqual(2);
  });
});

describe('lodTiers', () => {
  const pts = Float32Array.from({ length: 30 }, (_, i) => Math.floor(i / 3)); // point k = (k, k, k)
  const ids = (p: Float32Array) => triplets(p).map(([x]) => x as number);

  test('disjoint tiers of the requested sizes drawn from the input', () => {
    const tiers = lodTiers(pts, [2, 3, 4], mulberry32(3));
    expect(tiers.map((t) => t.length / 3)).toEqual([2, 3, 4]);
    const all = tiers.flatMap(ids);
    expect(new Set(all).size).toBe(9);
    for (const t of tiers) for (const [x, y, z] of triplets(t)) expect([y, z]).toEqual([x, x]);
    for (const k of all) expect(k).toBeLessThan(10);
  });

  test('truncates when points run out; deterministic', () => {
    const tiers = lodTiers(pts, [4, 4, 4], mulberry32(3));
    expect(tiers.map((t) => t.length / 3)).toEqual([4, 4, 2]);
    expect(tiers.map(ids)).toEqual(lodTiers(pts, [4, 4, 4], mulberry32(3)).map(ids));
  });
});

describe('cloud codec', () => {
  const bbox: BBox = { min: [0, -100, 1000], max: [65535, 100, 2000] };

  test('bboxOf pads every axis', () => {
    expect(bboxOf(Float32Array.of(1, 2, 3, 5, -2, 4), 1)).toEqual({ min: [0, -3, 2], max: [6, 3, 5] });
  });

  test('bboxUnion spans every box and pads', () => {
    const a: BBox = { min: [0, 5, -1], max: [1, 6, 0] };
    const b: BBox = { min: [-2, 7, 3], max: [0, 9, 4] };
    expect(bboxUnion([a, b], 1)).toEqual({ min: [-3, 4, -2], max: [2, 10, 5] });
    expect(() => bboxUnion([], 0)).toThrow();
  });

  test('roundtrip within half a quantization step', () => {
    const pos = Float32Array.of(0, -100, 1000, 12345.4, 3.3, 1500.5, 65535, 100, 2000);
    const out = decodeCloud(encodeCloud(pos, bbox), bbox);
    expect(out.length).toBe(pos.length);
    for (let i = 0; i < pos.length; i++) {
      const step = ((bbox.max[i % 3] as number) - (bbox.min[i % 3] as number)) / 65535;
      expect(Math.abs((out[i] as number) - (pos[i] as number))).toBeLessThanOrEqual(step / 2 + 1e-3);
    }
  });

  test('rejects a chunk of another kind', () => {
    expect(() => decodeCloud(encodeChunk('graph', [new Uint16Array(3)]), bbox)).toThrow(/cloud/);
  });
});
