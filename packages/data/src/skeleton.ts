import { decodeChunk, encodeChunk } from './container';
import type { Manifest } from './manifest';
import { childrenOf, type Skeleton } from './swc';

export type BBox = Manifest['bbox'];

const Q = 65535;

/**
 * RDP on every unbranched run between anchors (roots, branch points, leaves).
 * Anchors always survive; interior nodes survive if farther than epsilon from the chord.
 * Node order is preserved, so parent[i] < i still holds.
 */
export function simplify(sk: Skeleton, epsilon: number): Skeleton {
  const n = sk.parent.length;
  const { offsets, children } = childrenOf(sk);
  const degree = (i: number) => (offsets[i + 1] as number) - (offsets[i] as number);
  const anchor = new Uint8Array(n);
  for (let i = 0; i < n; i++) if ((sk.parent[i] as number) < 0 || degree(i) !== 1) anchor[i] = 1;

  const keep = anchor.slice();
  const run: number[] = [];
  for (let a = 0; a < n; a++) {
    if (!anchor[a]) continue;
    for (let k = offsets[a] as number; k < (offsets[a + 1] as number); k++) {
      run.length = 0;
      run.push(a);
      let u = children[k] as number;
      while (!anchor[u]) {
        run.push(u);
        u = children[offsets[u] as number] as number;
      }
      run.push(u);
      rdp(sk.pos, run, epsilon, keep);
    }
  }

  // nearest kept ancestor-or-self; parents precede children
  const up = new Int32Array(n);
  const newIdx = new Int32Array(n).fill(-1);
  let m = 0;
  for (let i = 0; i < n; i++) {
    up[i] = keep[i] ? i : (up[sk.parent[i] as number] as number);
    if (keep[i]) newIdx[i] = m++;
  }
  const pos = new Float32Array(m * 3);
  const radius = new Float32Array(m);
  const parent = new Int32Array(m);
  const type = new Uint8Array(m);
  for (let i = 0; i < n; i++) {
    const j = newIdx[i] as number;
    if (j < 0) continue;
    pos.set(sk.pos.subarray(i * 3, i * 3 + 3), j * 3);
    radius[j] = sk.radius[i] as number;
    type[j] = sk.type[i] as number;
    const p = sk.parent[i] as number;
    parent[j] = p < 0 ? -1 : (newIdx[up[p] as number] as number);
  }
  return { pos, radius, parent, type, soma: newIdx[sk.soma] as number };
}

/** Marks interior nodes of `run` (node indices, endpoints already kept) that RDP retains. */
function rdp(pos: Float32Array, run: number[], epsilon: number, keep: Uint8Array): void {
  const stack = [0, run.length - 1];
  while (stack.length > 0) {
    const hi = stack.pop() as number;
    const lo = stack.pop() as number;
    let best = -1;
    let bestD = epsilon;
    for (let k = lo + 1; k < hi; k++) {
      const d = segmentDistance(pos, run[k] as number, run[lo] as number, run[hi] as number);
      if (d > bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best < 0) continue;
    keep[run[best] as number] = 1;
    stack.push(lo, best, best, hi);
  }
}

function segmentDistance(pos: Float32Array, p: number, a: number, b: number): number {
  const ax = pos[a * 3] as number;
  const ay = pos[a * 3 + 1] as number;
  const az = pos[a * 3 + 2] as number;
  const dx = (pos[b * 3] as number) - ax;
  const dy = (pos[b * 3 + 1] as number) - ay;
  const dz = (pos[b * 3 + 2] as number) - az;
  const px = (pos[p * 3] as number) - ax;
  const py = (pos[p * 3 + 1] as number) - ay;
  const pz = (pos[p * 3 + 2] as number) - az;
  const len2 = dx * dx + dy * dy + dz * dz;
  const t = len2 > 0 ? Math.min(1, Math.max(0, (px * dx + py * dy + pz * dz) / len2)) : 0;
  return Math.hypot(px - t * dx, py - t * dy, pz - t * dz);
}

/** Cable length from each node's root (the soma for component 0). */
export function pathDistance(sk: Skeleton): Float32Array {
  const out = new Float32Array(sk.parent.length);
  accumulate(sk.pos, sk.parent, 0, sk.parent.length, out);
  return out;
}

/** dist over nodes [from, to) whose parents are local indices relative to `from`. */
function accumulate(
  pos: Float32Array,
  parent: Int32Array,
  from: number,
  to: number,
  out: Float32Array,
): void {
  for (let i = from; i < to; i++) {
    const p = parent[i] as number;
    if (p < 0) {
      out[i] = 0;
      continue;
    }
    const q = from + p;
    out[i] =
      (out[q] as number) +
      Math.hypot(
        (pos[i * 3] as number) - (pos[q * 3] as number),
        (pos[i * 3 + 1] as number) - (pos[q * 3 + 1] as number),
        (pos[i * 3 + 2] as number) - (pos[q * 3 + 2] as number),
      );
  }
}

/** xyz triplets -> Uint16 in bbox, clamped; error ≤ half a step per axis. */
export function quantize(pos: Float32Array, bbox: BBox): Uint16Array {
  const out = new Uint16Array(pos.length);
  for (let i = 0; i < pos.length; i++) {
    const lo = bbox.min[i % 3] as number;
    const hi = bbox.max[i % 3] as number;
    const v = Math.round((((pos[i] as number) - lo) / (hi - lo)) * Q);
    out[i] = Math.min(Q, Math.max(0, v));
  }
  return out;
}

export function dequantize(q: Uint16Array, bbox: BBox): Float32Array {
  const out = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) {
    const lo = bbox.min[i % 3] as number;
    const hi = bbox.max[i % 3] as number;
    out[i] = lo + ((q[i] as number) * (hi - lo)) / Q;
  }
  return out;
}

/** Many neurons as flat arrays; neuron k owns nodes [offsets[k], offsets[k+1]), parents are local. */
export interface SkeletonSet {
  bodyIds: number[];
  offsets: Uint32Array;
  pos: Float32Array; // nm
  radius: Float32Array; // nm
  parent: Int32Array;
  dist: Float32Array; // path distance from the neuron's soma, nm
}

const U32 = 2 ** 32;

/**
 * `skeletons` chunk sections: offsets u32 (m+1) | bodyId u32 lo,hi (2m) |
 * pos u16 (3N, bbox-quantized) | radius u16 (N, whole nm, clamped) | parent i32 (N, local, -1 root).
 */
export function encodeSkeletons(items: { bodyId: number; skeleton: Skeleton }[], bbox: BBox): Uint8Array {
  const m = items.length;
  const offsets = new Uint32Array(m + 1);
  const ids = new Uint32Array(m * 2);
  items.forEach(({ bodyId, skeleton }, k) => {
    offsets[k + 1] = (offsets[k] as number) + skeleton.parent.length;
    ids[k * 2] = bodyId % U32;
    ids[k * 2 + 1] = Math.floor(bodyId / U32);
  });
  const total = offsets[m] as number;
  const pos = new Float32Array(total * 3);
  const radius = new Uint16Array(total);
  const parent = new Int32Array(total);
  items.forEach(({ skeleton }, k) => {
    const at = offsets[k] as number;
    pos.set(skeleton.pos, at * 3);
    parent.set(skeleton.parent, at);
    skeleton.radius.forEach((r, i) => {
      radius[at + i] = Math.min(Q, Math.round(r));
    });
  });
  return encodeChunk('skeletons', [offsets, ids, quantize(pos, bbox), radius, parent]);
}

export function decodeSkeletons(bytes: ArrayBuffer | Uint8Array, bbox: BBox): SkeletonSet {
  const { kind, sections } = decodeChunk(bytes);
  if (kind !== 'skeletons') throw new Error(`expected skeletons chunk, got ${kind}`);
  const [offsets, ids, q, r, parent] = sections;
  if (
    !(offsets instanceof Uint32Array) ||
    !(ids instanceof Uint32Array) ||
    !(q instanceof Uint16Array) ||
    !(r instanceof Uint16Array) ||
    !(parent instanceof Int32Array)
  ) {
    throw new Error('skeletons chunk: unexpected section layout');
  }
  const m = offsets.length - 1;
  const bodyIds = Array.from(
    { length: m },
    (_, k) => (ids[k * 2] as number) + (ids[k * 2 + 1] as number) * U32,
  );
  const pos = dequantize(q, bbox);
  const dist = new Float32Array(parent.length);
  for (let k = 0; k < m; k++) accumulate(pos, parent, offsets[k] as number, offsets[k + 1] as number, dist);
  return { bodyIds, offsets, pos, radius: Float32Array.from(r), parent, dist };
}
