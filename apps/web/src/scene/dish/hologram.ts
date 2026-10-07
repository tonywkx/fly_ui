import type { BBox, NeuropilSet } from '@fly/data';
import type { DecisionPath } from '@fly/sim';

export type Vec3 = [number, number, number];
export type Side = 'L' | 'R';

/** Repeated hops in one neuropil are spread this far apart (source units, ≈ 24 µm at 8 nm). */
export const SPREAD = 3000;

/** `n` points picked at random (seeded) from an xyz array; all of them if it has fewer. */
export function sample(pos: Float32Array, n: number, rand: () => number): Float32Array {
  const total = pos.length / 3;
  if (n >= total) return pos.slice();
  const out = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const i = Math.floor(rand() * total) * 3;
    out[k * 3] = pos[i] as number;
    out[k * 3 + 1] = pos[i + 1] as number;
    out[k * 3 + 2] = pos[i + 2] as number;
  }
  return out;
}

/** Vertex mean of each named mesh (source units). */
export function centroids(set: NeuropilSet): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  for (const r of set.ranges) {
    let [x, y, z] = [0, 0, 0];
    for (let v = r.vertStart; v < r.vertStart + r.vertCount; v++) {
      x += set.pos[v * 3] as number;
      y += set.pos[v * 3 + 1] as number;
      z += set.pos[v * 3 + 2] as number;
    }
    const n = Math.max(1, r.vertCount);
    out.set(r.name, [x / n, y / n, z / n]);
  }
  return out;
}

/** A neuropil's centre: the stimulus side's half (left without a side), else the unpaired one, else both halves' mean. */
export function site(c: Map<string, Vec3>, region: string, side: Side | null): Vec3 | null {
  const own = c.get(`${region}(${side ?? 'L'})`) ?? c.get(region);
  if (own) return [...own];
  const l = c.get(`${region}(L)`);
  const r = c.get(`${region}(R)`);
  if (l && r) return l.map((x, i) => (x + (r[i] as number)) / 2) as Vec3;
  return null;
}

/** Each hop's point (source units); hops in a neuropil already used are fanned out by `SPREAD`. */
export function hopSites(path: DecisionPath, side: Side | null, c: Map<string, Vec3>): (Vec3 | null)[] {
  const used = new Map<string, number>();
  return path.hops.map((h) => {
    const p = site(c, h.region, side);
    if (!p) return null;
    const k = used.get(h.region) ?? 0;
    used.set(h.region, k + 1);
    if (k > 0) {
      const a = k * 2.4;
      p[0] += SPREAD * Math.cos(a);
      p[1] += SPREAD * Math.sin(a);
    }
    return p;
  });
}

/**
 * Source units → the fly's frame (x forward, y up, z to her right; as `FlyView`): the CNS lies in EM
 * space as in the fly (anterior −z, dorsal −y, left +x), so this is a proper rotation, no mirror.
 * Bbox centred, its width (x) scaled to `width`. `rows` feed `Matrix4.set`.
 */
export function holoFrame(
  bbox: BBox,
  width: number,
): { rows: number[]; map: (p: ArrayLike<number>) => Vec3 } {
  const c = bbox.min.map((v, i) => (v + (bbox.max[i] as number)) / 2) as Vec3;
  const s = width / ((bbox.max[0] as number) - (bbox.min[0] as number));
  return {
    rows: [0, 0, -s, s * c[2], 0, -s, 0, s * c[1], -s, 0, 0, s * c[0], 0, 0, 0, 1],
    map: (p) => [
      -((p[2] as number) - c[2]) * s,
      -((p[1] as number) - c[1]) * s,
      -((p[0] as number) - c[0]) * s,
    ],
  };
}
