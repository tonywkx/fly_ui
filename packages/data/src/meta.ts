import { decodeChunk, encodeChunk, type Section } from './container';

export const NTS = [
  'acetylcholine',
  'gaba',
  'glutamate',
  'histamine',
  'dopamine',
  'serotonin',
  'octopamine',
  'tyramine',
  'unclear',
] as const;
export type Nt = (typeof NTS)[number];

export const SOMA_SIDES = ['L', 'R', 'M'] as const;
export type SomaSide = (typeof SOMA_SIDES)[number];

/** Index value meaning "absent" in u8 / u16 columns. */
export const NONE8 = 0xff;
export const NONE16 = 0xffff;
export const FLAG_MALE_SPECIFIC = 1;

export interface NeuronRecord {
  bodyId: number;
  type: string | null;
  class: string | null;
  superclass: string | null;
  nt: Nt | null;
  /** 0..1, stored as u8. */
  ntConf: number | null;
  /** Synaptic sign of this neuron as presynaptic partner (see DECISIONS.md). */
  sign: -1 | 0 | 1;
  /** Primary ROI with the most synapses. */
  region: string | null;
  somaSide: SomaSide | null;
  maleSpecific: boolean;
}

export interface MetaStrings {
  types: string[];
  classes: string[];
  superclasses: string[];
  regions: string[];
}

/** Columnar neuron table; row i matches graph row i. String columns index into `strings`. */
export interface NeuronTable {
  n: number;
  bodyIds: Float64Array;
  type: Uint16Array;
  region: Uint16Array;
  class: Uint8Array;
  superclass: Uint8Array;
  nt: Uint8Array; // index into NTS or NONE8
  sign: Int8Array;
  ntConf: Uint8Array; // conf * 255; 0 when unknown (nt is NONE8)
  flags: Uint8Array;
  somaSide: Uint8Array; // index into SOMA_SIDES or NONE8
  strings: MetaStrings;
}

const U32 = 2 ** 32;

function dictionary(name: string, values: (string | null)[], none: number) {
  const list: string[] = [];
  const index = new Map<string, number>();
  const codes = values.map((v) => {
    if (v === null) return none;
    let i = index.get(v);
    if (i === undefined) {
      i = list.length;
      if (i >= none) throw new Error(`meta: more than ${none} distinct ${name} values`);
      list.push(v);
      index.set(v, i);
    }
    return i;
  });
  return { list, codes };
}

/**
 * `meta` chunk sections: bodyId u32 lo,hi (2n) | type u16 | region u16 | class u8 | superclass u8 |
 * nt u8 | sign i8 | ntConf u8 | flags u8 | somaSide u8 | strings u8 (UTF-8 JSON MetaStrings).
 */
export function encodeMeta(rows: NeuronRecord[]): Uint8Array {
  const n = rows.length;
  const ids = new Uint32Array(n * 2);
  rows.forEach((r, i) => {
    ids[i * 2] = r.bodyId % U32;
    ids[i * 2 + 1] = Math.floor(r.bodyId / U32);
  });
  const types = dictionary(
    'type',
    rows.map((r) => r.type),
    NONE16,
  );
  const regions = dictionary(
    'region',
    rows.map((r) => r.region),
    NONE16,
  );
  const classes = dictionary(
    'class',
    rows.map((r) => r.class),
    NONE8,
  );
  const superclasses = dictionary(
    'superclass',
    rows.map((r) => r.superclass),
    NONE8,
  );
  const strings: MetaStrings = {
    types: types.list,
    classes: classes.list,
    superclasses: superclasses.list,
    regions: regions.list,
  };
  const enumOf = (list: readonly string[], v: string | null) => {
    if (v === null) return NONE8;
    const i = list.indexOf(v);
    if (i < 0) throw new Error(`meta: unknown value ${v}`);
    return i;
  };
  const sections: Section[] = [
    ids,
    Uint16Array.from(types.codes),
    Uint16Array.from(regions.codes),
    Uint8Array.from(classes.codes),
    Uint8Array.from(superclasses.codes),
    Uint8Array.from(rows, (r) => enumOf(NTS, r.nt)),
    Int8Array.from(rows, (r) => r.sign),
    Uint8Array.from(rows, (r) => Math.round(Math.min(1, Math.max(0, r.ntConf ?? 0)) * 255)),
    Uint8Array.from(rows, (r) => (r.maleSpecific ? FLAG_MALE_SPECIFIC : 0)),
    Uint8Array.from(rows, (r) => enumOf(SOMA_SIDES, r.somaSide)),
    new TextEncoder().encode(JSON.stringify(strings)),
  ];
  return encodeChunk('meta', sections);
}

export function decodeMeta(bytes: ArrayBuffer | Uint8Array): NeuronTable {
  const { kind, sections: s } = decodeChunk(bytes);
  if (kind !== 'meta') throw new Error(`expected meta chunk, got ${kind}`);
  const [ids, type, region, cls, superclass, nt, sign, ntConf, flags, somaSide, str] = s;
  if (
    !(ids instanceof Uint32Array) ||
    !(type instanceof Uint16Array) ||
    !(region instanceof Uint16Array) ||
    !(cls instanceof Uint8Array) ||
    !(superclass instanceof Uint8Array) ||
    !(nt instanceof Uint8Array) ||
    !(sign instanceof Int8Array) ||
    !(ntConf instanceof Uint8Array) ||
    !(flags instanceof Uint8Array) ||
    !(somaSide instanceof Uint8Array) ||
    !(str instanceof Uint8Array)
  )
    throw new Error('meta chunk: unexpected section layout');
  const n = type.length;
  const bodyIds = new Float64Array(n);
  for (let i = 0; i < n; i++) bodyIds[i] = (ids[i * 2] as number) + (ids[i * 2 + 1] as number) * U32;
  const strings = JSON.parse(new TextDecoder().decode(str)) as MetaStrings;
  return { n, bodyIds, type, region, class: cls, superclass, nt, sign, ntConf, flags, somaSide, strings };
}

/** Row i as a plain record (inspector, tests); not for hot loops. */
export function neuronAt(t: NeuronTable, i: number): NeuronRecord {
  const str = (list: string[], code: number, none: number) => (code === none ? null : (list[code] ?? null));
  const ntCode = t.nt[i] as number;
  const side = t.somaSide[i] as number;
  return {
    bodyId: t.bodyIds[i] as number,
    type: str(t.strings.types, t.type[i] as number, NONE16),
    class: str(t.strings.classes, t.class[i] as number, NONE8),
    superclass: str(t.strings.superclasses, t.superclass[i] as number, NONE8),
    nt: ntCode === NONE8 ? null : (NTS[ntCode] ?? null),
    ntConf: ntCode === NONE8 ? null : (t.ntConf[i] as number) / 255,
    sign: t.sign[i] as -1 | 0 | 1,
    region: str(t.strings.regions, t.region[i] as number, NONE16),
    somaSide: side === NONE8 ? null : (SOMA_SIDES[side] ?? null),
    maleSpecific: ((t.flags[i] as number) & FLAG_MALE_SPECIFIC) !== 0,
  };
}
