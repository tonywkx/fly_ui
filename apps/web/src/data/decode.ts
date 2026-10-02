import {
  type BBox,
  type ChunkKind,
  type Csr,
  decodeCloud,
  decodeGraph,
  decodeMeta,
  decodeNeuropils,
  decodeSkeletons,
  decodeTypeGraph,
  type NeuronTable,
  type NeuropilSet,
  type SkeletonSet,
  type TypeGraph,
} from '@fly/data';

export type Decoded =
  | { kind: 'cloud'; data: Float32Array }
  | { kind: 'neuropil'; data: NeuropilSet }
  | { kind: 'skeletons'; data: SkeletonSet }
  | { kind: 'graph'; data: Csr }
  | { kind: 'typegraph'; data: TypeGraph }
  | { kind: 'meta'; data: NeuronTable };

/** Pure: decodes a chunk whose kind the manifest declares (decoders throw on a mismatch). */
export function decodeByKind(kind: ChunkKind, bytes: ArrayBuffer | Uint8Array, bbox: BBox): Decoded {
  switch (kind) {
    case 'cloud':
      return { kind, data: decodeCloud(bytes, bbox) };
    case 'neuropil':
      return { kind, data: decodeNeuropils(bytes, bbox) };
    case 'skeletons':
      return { kind, data: decodeSkeletons(bytes, bbox) };
    case 'graph':
      return { kind, data: decodeGraph(bytes) };
    case 'typegraph':
      return { kind, data: decodeTypeGraph(bytes) };
    case 'meta':
      return { kind, data: decodeMeta(bytes) };
  }
}

/** Distinct ArrayBuffers behind every typed array in `value` (for zero-copy postMessage). */
export function transferables(value: unknown, out = new Set<ArrayBuffer>()): ArrayBuffer[] {
  if (ArrayBuffer.isView(value)) {
    if (value.buffer instanceof ArrayBuffer) out.add(value.buffer);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) transferables(v, out);
  }
  return [...out];
}
