import {
  type Csr,
  csrFromEdges,
  type NeuronRecord,
  NTS,
  type Nt,
  SOMA_SIDES,
  type SomaSide,
} from '@fly/data';
import type { EdgeBatch, RawNeuron } from '../fetch/graph';

/** Below this NT confidence the sign is 0 (DECISIONS.md). */
export const MIN_NT_CONF = 0.6;
const MOTOR = new Set(['vnc_motor', 'cb_motor']);
const SIGN: Partial<Record<Nt, -1 | 1>> = { acetylcholine: 1, gaba: -1, glutamate: -1, histamine: -1 };

/** Presynaptic sign: ACh +, GABA/Glu/His −; low confidence, modulatory, unclear and motor neurons → 0. */
export function ntSign(r: Pick<NeuronRecord, 'nt' | 'ntConf' | 'superclass'>): -1 | 0 | 1 {
  if (r.nt === null || (r.ntConf ?? 0) < MIN_NT_CONF) return 0;
  if (r.superclass !== null && MOTOR.has(r.superclass)) return 0;
  return SIGN[r.nt] ?? 0;
}

export function toRecord(r: RawNeuron): NeuronRecord {
  const nt = r.nt === null ? null : (NTS as readonly string[]).includes(r.nt) ? (r.nt as Nt) : 'unclear';
  const rec: NeuronRecord = {
    bodyId: r.bodyId,
    type: r.type,
    class: r.class,
    superclass: r.superclass,
    nt,
    ntConf: nt === null ? null : r.ntConf,
    sign: 0,
    region: r.region,
    somaSide: (SOMA_SIDES as readonly string[]).includes(r.somaSide ?? '') ? (r.somaSide as SomaSide) : null,
    maleSpecific: r.fruDsx !== null && r.fruDsx !== 'fru_low',
  };
  rec.sign = ntSign(rec);
  return rec;
}

/** Row order: by type (untyped last), then bodyId — keeps types contiguous and col deltas small. */
export function orderNeurons(rows: NeuronRecord[]): NeuronRecord[] {
  return [...rows].sort((a, b) => {
    if (a.type !== b.type) {
      if (a.type === null) return 1;
      if (b.type === null) return -1;
      return a.type < b.type ? -1 : 1;
    }
    return a.bodyId - b.bodyId;
  });
}

export interface Graph {
  meta: NeuronRecord[];
  csr: Csr;
}

/** Maps bodyIds to row indices of `meta` (already ordered); edges touching unknown bodies are dropped. */
export function buildGraph(meta: NeuronRecord[], batches: EdgeBatch[]): Graph & { dropped: number } {
  const index = new Map(meta.map((r, i) => [r.bodyId, i]));
  const total = batches.reduce((s, b) => s + b.pre.length, 0);
  const pre = new Uint32Array(total);
  const post = new Uint32Array(total);
  const w = new Uint32Array(total);
  let m = 0;
  for (const b of batches) {
    for (let e = 0; e < b.pre.length; e++) {
      const a = index.get(b.pre[e] as number);
      const c = index.get(b.post[e] as number);
      if (a === undefined || c === undefined) continue;
      pre[m] = a;
      post[m] = c;
      w[m] = b.w[e] as number;
      m++;
    }
  }
  return {
    meta,
    csr: csrFromEdges(meta.length, pre.subarray(0, m), post.subarray(0, m), w.subarray(0, m)),
    dropped: total - m,
  };
}

/** Induced subgraph on the given bodies, keeping the parent graph's row order. */
export function subgraph(g: Graph, bodyIds: Iterable<number>): Graph {
  const want = new Set(bodyIds);
  const keep: number[] = [];
  g.meta.forEach((r, i) => {
    if (want.has(r.bodyId)) keep.push(i);
  });
  const local = new Map(keep.map((old, i) => [old, i]));
  const pre: number[] = [];
  const post: number[] = [];
  const w: number[] = [];
  keep.forEach((old, i) => {
    const { offsets, cols, weight } = g.csr;
    for (let e = offsets[old] as number; e < (offsets[old + 1] as number); e++) {
      const j = local.get(cols[e] as number);
      if (j === undefined) continue;
      pre.push(i);
      post.push(j);
      w.push(weight[e] as number);
    }
  });
  return { meta: keep.map((i) => g.meta[i] as NeuronRecord), csr: csrFromEdges(keep.length, pre, post, w) };
}
