import { CHUNK_KINDS, type ChunkKind, FORMAT_VERSION } from './manifest';

/**
 * Binary chunk layout (little-endian):
 *   header 16 B: magic "FLYD" | formatVersion u16 | kind u16 | sectionCount u32 | reserved u32
 *   table  12 B × n: dtype u8 | 3 B pad | byteOffset u32 | length u32 (elements)
 *   data   each section starts at a 4-byte aligned offset
 */
export type Section =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array;

type SectionCtor = {
  new (buffer: ArrayBuffer, byteOffset: number, length: number): Section;
  BYTES_PER_ELEMENT: number;
};

const DTYPES: SectionCtor[] = [
  Int8Array,
  Uint8Array,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
];

const MAGIC = 0x4459_4c46; // "FLYD" read as LE u32
const HEADER = 16;
const ENTRY = 12;

const align4 = (n: number) => (n + 3) & ~3;

export function encodeChunk(kind: ChunkKind, sections: Section[]): Uint8Array {
  const tableEnd = HEADER + ENTRY * sections.length;
  let end = tableEnd;
  const layout = sections.map((s) => {
    const offset = align4(end);
    end = offset + s.byteLength;
    return { s, offset };
  });
  const out = new Uint8Array(align4(end));
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint16(4, FORMAT_VERSION, true);
  dv.setUint16(6, CHUNK_KINDS.indexOf(kind), true);
  dv.setUint32(8, sections.length, true);
  layout.forEach(({ s, offset }, i) => {
    const dtype = DTYPES.indexOf(s.constructor as SectionCtor);
    if (dtype < 0) throw new Error(`unsupported section type ${s.constructor.name}`);
    const at = HEADER + ENTRY * i;
    dv.setUint8(at, dtype);
    dv.setUint32(at + 4, offset, true);
    dv.setUint32(at + 8, s.length, true);
    out.set(new Uint8Array(s.buffer, s.byteOffset, s.byteLength), offset);
  });
  return out;
}

export interface DecodedChunk {
  kind: ChunkKind;
  sections: Section[];
}

/** Sections are views into the input buffer (copied once only if the input is not 4-byte aligned). */
export function decodeChunk(input: ArrayBuffer | Uint8Array): DecodedChunk {
  let bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteOffset % 4 !== 0) bytes = bytes.slice();
  if (bytes.byteLength < HEADER) throw new Error('chunk truncated: no header');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('chunk: bad magic');
  const version = dv.getUint16(4, true);
  if (version !== FORMAT_VERSION) throw new Error(`chunk format version ${version} != ${FORMAT_VERSION}`);
  const kind = CHUNK_KINDS[dv.getUint16(6, true)];
  if (!kind) throw new Error(`chunk: unknown kind ${dv.getUint16(6, true)}`);
  const n = dv.getUint32(8, true);
  if (bytes.byteLength < HEADER + ENTRY * n) throw new Error('chunk truncated: section table');

  const sections: Section[] = [];
  for (let i = 0; i < n; i++) {
    const at = HEADER + ENTRY * i;
    const Ctor = DTYPES[dv.getUint8(at)];
    if (!Ctor) throw new Error(`chunk: unknown dtype ${dv.getUint8(at)}`);
    const offset = dv.getUint32(at + 4, true);
    const length = dv.getUint32(at + 8, true);
    if (offset % 4 !== 0) throw new Error(`chunk: section ${i} misaligned`);
    if (offset + length * Ctor.BYTES_PER_ELEMENT > bytes.byteLength) {
      throw new Error(`chunk truncated: section ${i}`);
    }
    sections.push(new Ctor(bytes.buffer as ArrayBuffer, bytes.byteOffset + offset, length));
  }
  return { kind, sections };
}
