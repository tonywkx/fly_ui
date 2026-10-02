import type { Net } from './net';

/** Fixed weight (mV) for every existing pre-type → post-type edge, e.g. gap junctions the chemical connectome misses. */
export interface SimOverride {
  pre: string;
  post: string;
  mV: number;
}

/**
 * Literature overrides shared by bake and the live worker (see data/scout/escape.json `overrides`).
 * GF (DNp01) → TTMn / PSI are mostly electrical; chemically GF is sign 0 (NT conf 0.53), so without this it drives nothing.
 * 40 mV (≫ vThreshold − vRest = 7) survives TTMn's strong inhibitory input: escape TTMn ≈ 230 Hz, first spike ≈ 8.5 ms
 * vs ≈ 35 Hz / 21 ms with GF silenced (scenarios.bio.ts).
 */
export const NET_OVERRIDES: readonly SimOverride[] = [
  { pre: 'DNp01', post: 'TTMn', mV: 40 },
  { pre: 'DNp01', post: 'PSI', mV: 40 },
];

/** Copy of `net` with overridden weights; only edges already in the connectome are touched (keeps sidedness). */
export function applyOverrides(net: Net, types: ArrayLike<string | null>, list: readonly SimOverride[]): Net {
  const w = net.w.slice();
  for (const o of list) {
    let hits = 0;
    for (let k = 0; k < net.n; k++) {
      if (types[k] !== o.pre) continue;
      for (let e = net.offsets[k] as number; e < (net.offsets[k + 1] as number); e++) {
        if (types[net.cols[e] as number] !== o.post) continue;
        w[e] = o.mV;
        hits++;
      }
    }
    if (!hits) throw new Error(`applyOverrides: no ${o.pre} → ${o.post} edges`);
  }
  return { ...net, w };
}
