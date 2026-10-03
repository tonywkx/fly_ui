import { type NeuronTable, NONE8, NONE16, NTS, type SkeletonSet } from '@fly/data';

/**
 * Floats per segment: `a.xyz, distA | b.xyz, distB | row, nt, radius, region`. a = node, b = its
 * parent (source units); row = meta/graph row (-1 if absent); nt = index into NTS; radius of node a;
 * region = index into `meta.strings.regions` (-1 if unknown).
 */
export const SEG_STRIDE = 12;

const UNCLEAR = NTS.indexOf('unclear');

/** One segment per non-root skeleton node, meta joined by bodyId. */
export function buildSegments(sk: SkeletonSet, meta: NeuronTable): Float32Array {
  const rowOf = new Map<number, number>();
  for (let i = 0; i < meta.n; i++) rowOf.set(meta.bodyIds[i] as number, i);

  let count = 0;
  for (const p of sk.parent) if (p >= 0) count++;
  const out = new Float32Array(count * SEG_STRIDE);

  let o = 0;
  for (let k = 0; k < sk.bodyIds.length; k++) {
    const row = rowOf.get(sk.bodyIds[k] as number) ?? -1;
    const code = row < 0 ? NONE8 : (meta.nt[row] as number);
    const nt = code === NONE8 ? UNCLEAR : code;
    const reg = row < 0 ? NONE16 : (meta.region[row] as number);
    const region = reg === NONE16 ? -1 : reg;
    const base = sk.offsets[k] as number;
    for (let i = base; i < (sk.offsets[k + 1] as number); i++) {
      const p = sk.parent[i] as number;
      if (p < 0) continue;
      const j = base + p;
      out.set(sk.pos.subarray(i * 3, i * 3 + 3), o);
      out[o + 3] = sk.dist[i] as number;
      out.set(sk.pos.subarray(j * 3, j * 3 + 3), o + 4);
      out[o + 7] = sk.dist[j] as number;
      out[o + 8] = row;
      out[o + 9] = nt;
      out[o + 10] = sk.radius[i] as number;
      out[o + 11] = region;
      o += SEG_STRIDE;
    }
  }
  return out;
}

/** Per row `cx, cy, cz, radius` (source units): bbox centre and half-diagonal; radius −1 = no segments. */
export function rowBounds(seg: Float32Array, rows: number): Float32Array {
  const lo = new Float32Array(rows * 3).fill(Infinity);
  const hi = new Float32Array(rows * 3).fill(-Infinity);
  for (let o = 0; o < seg.length; o += SEG_STRIDE) {
    const row = seg[o + 8] as number;
    if (row < 0 || row >= rows) continue;
    for (const p of [o, o + 4])
      for (let k = 0; k < 3; k++) {
        const v = seg[p + k] as number;
        const i = row * 3 + k;
        if (v < (lo[i] as number)) lo[i] = v;
        if (v > (hi[i] as number)) hi[i] = v;
      }
  }
  const out = new Float32Array(rows * 4);
  for (let r = 0; r < rows; r++) {
    if (!Number.isFinite(lo[r * 3] as number)) {
      out[r * 4 + 3] = -1;
      continue;
    }
    let d2 = 0;
    for (let k = 0; k < 3; k++) {
      const a = lo[r * 3 + k] as number;
      const b = hi[r * 3 + k] as number;
      out[r * 4 + k] = (a + b) / 2;
      d2 += ((b - a) / 2) ** 2;
    }
    out[r * 4 + 3] = Math.sqrt(d2);
  }
  return out;
}
