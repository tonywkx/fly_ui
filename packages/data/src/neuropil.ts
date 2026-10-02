import { decodeChunk, encodeChunk } from './container';
import type { Mesh } from './obj';
import { type BBox, dequantize, quantize } from './skeleton';

export interface NamedMesh extends Mesh {
  name: string;
}

export interface NeuropilRange {
  name: string;
  vertStart: number;
  vertCount: number;
  indexStart: number;
  indexCount: number;
}

/** All meshes of a chunk merged into one geometry; `ranges` maps names to vertex/index groups. */
export interface NeuropilSet {
  pos: Float32Array;
  index: Uint32Array;
  ranges: NeuropilRange[];
}

const MAX_VERTS = 0xffff;

/**
 * `neuropil` chunk sections: pos u16 (3V, bbox-quantized) | index u16 (local to each mesh) |
 * ranges u32 (vertStart, vertCount, indexStart, indexCount per mesh) | names u8 (UTF-8 JSON array).
 */
export function encodeNeuropils(meshes: NamedMesh[], bbox: BBox): Uint8Array {
  const vertTotal = meshes.reduce((s, m) => s + m.pos.length / 3, 0);
  const indexTotal = meshes.reduce((s, m) => s + m.index.length, 0);
  const pos = new Float32Array(vertTotal * 3);
  const index = new Uint16Array(indexTotal);
  const ranges = new Uint32Array(meshes.length * 4);
  let v = 0;
  let ix = 0;
  meshes.forEach((m, k) => {
    const n = m.pos.length / 3;
    if (n > MAX_VERTS) throw new Error(`neuropil ${m.name}: ${n} vertices, max ${MAX_VERTS}`);
    for (const i of m.index) if (i >= n) throw new Error(`neuropil ${m.name}: index ${i} out of range`);
    pos.set(m.pos, v * 3);
    index.set(m.index, ix);
    ranges.set([v, n, ix, m.index.length], k * 4);
    v += n;
    ix += m.index.length;
  });
  const names = new TextEncoder().encode(JSON.stringify(meshes.map((m) => m.name)));
  return encodeChunk('neuropil', [quantize(pos, bbox), index, ranges, names]);
}

export function decodeNeuropils(bytes: ArrayBuffer | Uint8Array, bbox: BBox): NeuropilSet {
  const { kind, sections } = decodeChunk(bytes);
  if (kind !== 'neuropil') throw new Error(`expected neuropil chunk, got ${kind}`);
  const [q, local, r, nameBytes] = sections;
  if (
    !(q instanceof Uint16Array) ||
    !(local instanceof Uint16Array) ||
    !(r instanceof Uint32Array) ||
    !(nameBytes instanceof Uint8Array)
  )
    throw new Error('neuropil chunk: unexpected section layout');
  const names = JSON.parse(new TextDecoder().decode(nameBytes)) as string[];
  const index = new Uint32Array(local.length);
  const ranges = names.map((name, k) => {
    const at = (j: number) => r[k * 4 + j] as number;
    const range: NeuropilRange = {
      name,
      vertStart: at(0),
      vertCount: at(1),
      indexStart: at(2),
      indexCount: at(3),
    };
    for (let i = range.indexStart; i < range.indexStart + range.indexCount; i++)
      index[i] = (local[i] as number) + range.vertStart;
    return range;
  });
  return { pos: dequantize(q, bbox), index, ranges };
}
