import { decodeChunk, encodeChunk } from './container';

/** Outgoing adjacency: neuron k (pre) targets cols[offsets[k]..offsets[k+1]), sorted ascending. */
export interface Csr {
  offsets: Uint32Array; // n+1
  cols: Uint32Array; // post indices
  weight: Uint16Array; // synapse count; signed weight = sign[pre] * weight (sign lives in meta)
}

const MAX_WEIGHT = 0xffff;

/** Builds a CSR from an edge list; duplicate (pre, post) pairs are summed, weights clamped to u16. */
export function csrFromEdges(
  n: number,
  pre: ArrayLike<number>,
  post: ArrayLike<number>,
  weight: ArrayLike<number>,
): Csr {
  const m = pre.length;
  if (post.length !== m || weight.length !== m) throw new Error('csrFromEdges: edge array length mismatch');
  const offsets = new Uint32Array(n + 1);
  for (let e = 0; e < m; e++) {
    const a = pre[e] as number;
    const b = post[e] as number;
    if (!(a >= 0 && a < n && b >= 0 && b < n)) throw new Error(`csrFromEdges: edge ${a}->${b} out of range`);
    offsets[a + 1] = (offsets[a + 1] as number) + 1;
  }
  for (let k = 0; k < n; k++) offsets[k + 1] = (offsets[k + 1] as number) + (offsets[k] as number);

  // counting sort by pre, then sort each row by post and merge duplicates
  const cursor = offsets.slice(0, n);
  const order = new Uint32Array(m);
  for (let e = 0; e < m; e++) {
    const a = pre[e] as number;
    order[cursor[a] as number] = e;
    cursor[a] = (cursor[a] as number) + 1;
  }
  const cols = new Uint32Array(m);
  const w = new Float64Array(m);
  const out = new Uint32Array(n + 1);
  let len = 0;
  for (let k = 0; k < n; k++) {
    const row = Array.from(order.subarray(offsets[k], offsets[k + 1])).sort(
      (x, y) => (post[x] as number) - (post[y] as number),
    );
    for (const e of row) {
      const b = post[e] as number;
      if (len > (out[k] as number) && cols[len - 1] === b)
        w[len - 1] = (w[len - 1] as number) + (weight[e] as number);
      else {
        cols[len] = b;
        w[len] = weight[e] as number;
        len++;
      }
    }
    out[k + 1] = len;
  }
  const clamped = new Uint16Array(len);
  for (let i = 0; i < len; i++) clamped[i] = Math.min(MAX_WEIGHT, Math.max(0, Math.round(w[i] as number)));
  return { offsets: out, cols: cols.slice(0, len), weight: clamped };
}

/**
 * `graph` chunk sections: offsets u32 (n+1) | cols u32 delta-coded per row (first absolute,
 * then difference to the previous col; compresses well) | weight u16 (synapse count).
 */
export function encodeGraph(g: Csr): Uint8Array {
  const { offsets, cols, weight } = g;
  const n = offsets.length - 1;
  if (n < 0 || offsets[0] !== 0 || offsets[n] !== cols.length || weight.length !== cols.length)
    throw new Error('graph: offsets do not match cols/weight');
  const deltas = new Uint32Array(cols.length);
  for (let k = 0; k < n; k++) {
    const start = offsets[k] as number;
    const end = offsets[k + 1] as number;
    if (end < start) throw new Error(`graph: offsets decrease at row ${k}`);
    for (let i = start; i < end; i++) {
      const c = cols[i] as number;
      if (c >= n) throw new Error(`graph: col ${c} out of range in row ${k}`);
      if (i > start && c <= (cols[i - 1] as number))
        throw new Error(`graph: row ${k} cols not sorted/unique`);
      deltas[i] = i > start ? c - (cols[i - 1] as number) : c;
    }
  }
  return encodeChunk('graph', [offsets, deltas, weight]);
}

export function decodeGraph(bytes: ArrayBuffer | Uint8Array): Csr {
  const { kind, sections } = decodeChunk(bytes);
  if (kind !== 'graph') throw new Error(`expected graph chunk, got ${kind}`);
  const [offsets, deltas, weight] = sections;
  if (
    !(offsets instanceof Uint32Array) ||
    !(deltas instanceof Uint32Array) ||
    !(weight instanceof Uint16Array)
  )
    throw new Error('graph chunk: unexpected section layout');
  const cols = new Uint32Array(deltas.length);
  for (let k = 0; k + 1 < offsets.length; k++) {
    let c = 0;
    for (let i = offsets[k] as number; i < (offsets[k + 1] as number); i++) {
      c += deltas[i] as number;
      cols[i] = c;
    }
  }
  return { offsets, cols, weight };
}
