import { decodeChunk, encodeChunk } from './container';
import { type BBox, dequantize, quantize } from './skeleton';
import type { Skeleton } from './swc';

export type Rand = () => number;

/** Small seeded PRNG, uniform in [0, 1). */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/**
 * Uniform points along the cable: each parent→child edge gets len/spacing points on average
 * (stochastic rounding), placed at random positions on the edge.
 */
export function sampleCable(sk: Skeleton, spacing: number, rand: Rand): Float32Array {
  const out: number[] = [];
  const { pos, parent } = sk;
  for (let i = 0; i < parent.length; i++) {
    const p = parent[i] as number;
    if (p < 0) continue;
    const ax = pos[p * 3] as number;
    const ay = pos[p * 3 + 1] as number;
    const az = pos[p * 3 + 2] as number;
    const dx = (pos[i * 3] as number) - ax;
    const dy = (pos[i * 3 + 1] as number) - ay;
    const dz = (pos[i * 3 + 2] as number) - az;
    const n = Math.floor(Math.hypot(dx, dy, dz) / spacing + rand());
    for (let k = 0; k < n; k++) {
      const t = rand();
      out.push(ax + t * dx, ay + t * dy, az + t * dz);
    }
  }
  return Float32Array.from(out);
}

/**
 * Shuffles points and cuts them into disjoint tiers of `counts` points (the last ones shrink when
 * points run out). Any prefix of tiers is a uniform subsample, so LOD k = tiers 0..k.
 */
export function lodTiers(points: Float32Array, counts: number[], rand: Rand): Float32Array[] {
  const n = points.length / 3;
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  let at = 0;
  return counts.map((c) => {
    const size = Math.min(c, n - at);
    const tier = new Float32Array(size * 3);
    for (let k = 0; k < size; k++, at++) {
      // partial Fisher–Yates: only as many swaps as points taken
      const j = at + Math.floor(rand() * (n - at));
      const pick = order[j] as number;
      order[j] = order[at] as number;
      order[at] = pick;
      tier.set(points.subarray(pick * 3, pick * 3 + 3), k * 3);
    }
    return tier;
  });
}

export function bboxOf(points: Float32Array, pad: number): BBox {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < points.length; i++) {
    const v = points[i] as number;
    const a = i % 3;
    if (v < (min[a] as number)) min[a] = v;
    if (v > (max[a] as number)) max[a] = v;
  }
  return {
    min: [(min[0] as number) - pad, (min[1] as number) - pad, (min[2] as number) - pad],
    max: [(max[0] as number) + pad, (max[1] as number) + pad, (max[2] as number) + pad],
  };
}

/** Smallest box containing every box, padded on all axes. */
export function bboxUnion(boxes: BBox[], pad: number): BBox {
  if (!boxes.length) throw new Error('bboxUnion: no boxes');
  const axes = [0, 1, 2] as const;
  return {
    min: axes.map((a) => Math.min(...boxes.map((b) => b.min[a])) - pad) as BBox['min'],
    max: axes.map((a) => Math.max(...boxes.map((b) => b.max[a])) + pad) as BBox['max'],
  };
}

/** `cloud` chunk (one per LOD tier): single section pos u16 (3N, bbox-quantized). */
export function encodeCloud(pos: Float32Array, bbox: BBox): Uint8Array {
  return encodeChunk('cloud', [quantize(pos, bbox)]);
}

export function decodeCloud(bytes: ArrayBuffer | Uint8Array, bbox: BBox): Float32Array {
  const { kind, sections } = decodeChunk(bytes);
  if (kind !== 'cloud') throw new Error(`expected cloud chunk, got ${kind}`);
  const [q] = sections;
  if (!(q instanceof Uint16Array)) throw new Error('cloud chunk: unexpected section layout');
  return dequantize(q, bbox);
}
