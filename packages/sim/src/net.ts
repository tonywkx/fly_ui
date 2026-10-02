/** Simulation graph: outgoing CSR with signed weights in mV (g kick per presynaptic spike). */
export interface Net {
  n: number;
  offsets: Uint32Array; // n+1
  cols: Uint32Array; // post indices
  w: Float32Array; // mV, signed
}

/** Structural match of `@fly/data` Csr (kept import-free: sim stays dependency-free). */
export interface CsrLike {
  offsets: Uint32Array;
  cols: Uint32Array;
  weight: ArrayLike<number>; // synapse count
}

/** Signed weight = sign[pre] · synapse count · wSyn (Dale: sign lives per neuron). */
export function netFromCsr(csr: CsrLike, sign: Int8Array, wSyn: number): Net {
  const n = csr.offsets.length - 1;
  const w = new Float32Array(csr.cols.length);
  for (let k = 0; k < n; k++) {
    const s = (sign[k] as number) * wSyn;
    for (let e = csr.offsets[k] as number; e < (csr.offsets[k + 1] as number); e++)
      w[e] = s * (csr.weight[e] as number);
  }
  return { n, offsets: csr.offsets, cols: csr.cols, w };
}

/** Builds a Net from [pre, post, mV] triples; rows keep insertion order. For tests and toy nets. */
export function netFromEdges(n: number, edges: readonly (readonly [number, number, number])[]): Net {
  const offsets = new Uint32Array(n + 1);
  for (const [a] of edges) offsets[a + 1] = (offsets[a + 1] as number) + 1;
  for (let k = 0; k < n; k++) offsets[k + 1] = (offsets[k + 1] as number) + (offsets[k] as number);
  const cursor = offsets.slice(0, n);
  const cols = new Uint32Array(edges.length);
  const w = new Float32Array(edges.length);
  for (const [a, b, x] of edges) {
    const e = cursor[a] as number;
    cols[e] = b;
    w[e] = x;
    cursor[a] = e + 1;
  }
  return { n, offsets, cols, w };
}
