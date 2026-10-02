import { decodeChunk, encodeChunk } from './container';
import type { Csr } from './graph';
import { type NeuronTable, NONE16 } from './meta';

/** Cell-type graph: node k = meta.strings.types[k], so meta.type[i] is neuron i's node directly. */
export interface TypeGraph {
  names: string[];
  count: Uint32Array; // neurons per type
  offsets: Uint32Array; // n+1
  cols: Uint32Array; // post type, sorted ascending per row; self-loops kept
  weight: Uint32Array; // summed synapse count
  signed: Int32Array; // Σ sign[pre] * weight
}

/** Collapses a neuron CSR by type; edges touching untyped neurons (NONE16) are skipped. */
export function collapseByType(csr: Csr, meta: Pick<NeuronTable, 'type' | 'sign' | 'strings'>): TypeGraph {
  const names = meta.strings.types;
  const n = names.length;
  const count = new Uint32Array(n);
  const rows: Map<number, [number, number]>[] = Array.from({ length: n }, () => new Map());
  const neurons = csr.offsets.length - 1;
  for (let i = 0; i < neurons; i++) {
    const a = meta.type[i] as number;
    if (a === NONE16) continue;
    count[a] = (count[a] as number) + 1;
    const sign = meta.sign[i] as number;
    const row = rows[a] as Map<number, [number, number]>;
    for (let e = csr.offsets[i] as number; e < (csr.offsets[i + 1] as number); e++) {
      const b = meta.type[csr.cols[e] as number] as number;
      if (b === NONE16) continue;
      const w = csr.weight[e] as number;
      const acc = row.get(b);
      if (acc) {
        acc[0] += w;
        acc[1] += sign * w;
      } else row.set(b, [w, sign * w]);
    }
  }
  const m = rows.reduce((s, r) => s + r.size, 0);
  const offsets = new Uint32Array(n + 1);
  const cols = new Uint32Array(m);
  const weight = new Uint32Array(m);
  const signed = new Int32Array(m);
  let len = 0;
  rows.forEach((row, k) => {
    for (const [b, [w, s]] of [...row].sort((x, y) => x[0] - y[0])) {
      cols[len] = b;
      weight[len] = w;
      signed[len] = s;
      len++;
    }
    offsets[k + 1] = len;
  });
  return { names, count, offsets, cols, weight, signed };
}

/**
 * `typegraph` chunk sections: offsets u32 (n+1) | cols u32 delta-coded per row | weight u32 |
 * signed i32 | count u32 (n) | names u8 (UTF-8 JSON string[]).
 */
export function encodeTypeGraph(g: TypeGraph): Uint8Array {
  const { offsets, cols, weight, signed, count, names } = g;
  const n = offsets.length - 1;
  if (
    n < 0 ||
    offsets[0] !== 0 ||
    offsets[n] !== cols.length ||
    weight.length !== cols.length ||
    signed.length !== cols.length
  )
    throw new Error('typegraph: offsets do not match cols/weight/signed');
  if (names.length !== n || count.length !== n) throw new Error('typegraph: names/count length != n');
  const deltas = new Uint32Array(cols.length);
  for (let k = 0; k < n; k++) {
    const start = offsets[k] as number;
    const end = offsets[k + 1] as number;
    if (end < start) throw new Error(`typegraph: offsets decrease at row ${k}`);
    for (let i = start; i < end; i++) {
      const c = cols[i] as number;
      if (c >= n) throw new Error(`typegraph: col ${c} out of range in row ${k}`);
      if (i > start && c <= (cols[i - 1] as number))
        throw new Error(`typegraph: row ${k} cols not sorted/unique`);
      deltas[i] = i > start ? c - (cols[i - 1] as number) : c;
    }
  }
  return encodeChunk('typegraph', [
    offsets,
    deltas,
    weight,
    signed,
    count,
    new TextEncoder().encode(JSON.stringify(names)),
  ]);
}

export function decodeTypeGraph(bytes: ArrayBuffer | Uint8Array): TypeGraph {
  const { kind, sections } = decodeChunk(bytes);
  if (kind !== 'typegraph') throw new Error(`expected typegraph chunk, got ${kind}`);
  const [offsets, deltas, weight, signed, count, str] = sections;
  if (
    !(offsets instanceof Uint32Array) ||
    !(deltas instanceof Uint32Array) ||
    !(weight instanceof Uint32Array) ||
    !(signed instanceof Int32Array) ||
    !(count instanceof Uint32Array) ||
    !(str instanceof Uint8Array)
  )
    throw new Error('typegraph chunk: unexpected section layout');
  const cols = new Uint32Array(deltas.length);
  for (let k = 0; k + 1 < offsets.length; k++) {
    let c = 0;
    for (let i = offsets[k] as number; i < (offsets[k + 1] as number); i++) {
      c += deltas[i] as number;
      cols[i] = c;
    }
  }
  const names = JSON.parse(new TextDecoder().decode(str)) as string[];
  return { names, count, offsets, cols, weight, signed };
}
