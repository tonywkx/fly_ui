import { type NeuronTable, NONE8, NONE16 } from '@fly/data';

/** Timeline raster bands, top to bottom in signal-flow order. */
export const BANDS = ['Optic lobes', 'Central brain', 'Descending', 'VNC'] as const;
export const BAND = { optic: 0, central: 1, descending: 2, vnc: 3 } as const;

const OPTIC = new Set(['LA', 'ME', 'AME', 'LO', 'LOP']);
/** VNC neuropils besides the tectula (`*Tct`). */
const VNC = new Set(['LegNp', 'ANm', 'Ov', 'DMetaN', 'mVAC', 'PDMNp', 'ProNm', 'VProN', 'MesoAN', 'MetaAN']);

/** Band of a neuron by its primary ROI; descending neurons by superclass whatever their ROI. */
export function bandOf(region: string | null, superclass: string | null): number {
  if (superclass === 'descending_neuron') return BAND.descending;
  if (!region) return BAND.central;
  const base = region.split('(')[0] as string;
  if (OPTIC.has(base)) return BAND.optic;
  if (VNC.has(base) || base.endsWith('Tct')) return BAND.vnc;
  return BAND.central;
}

export interface Lanes {
  /** Band per scenario row. */
  band: Uint8Array;
  /** Position within the band, 0 ≤ rank < 1; rows of one type are adjacent. */
  rank: Float32Array;
  /** Rows per band. */
  counts: Uint32Array;
}

/** Raster lane of every scenario row. */
export function lanes(meta: NeuronTable): Lanes {
  const { n, strings } = meta;
  const band = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = meta.region[i] as number;
    const s = meta.superclass[i] as number;
    band[i] = bandOf(
      r === NONE16 ? null : (strings.regions[r] ?? null),
      s === NONE8 ? null : (strings.superclasses[s] ?? null),
    );
  }
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => (meta.type[a] as number) - (meta.type[b] as number) || a - b,
  );
  const counts = new Uint32Array(BANDS.length);
  for (let i = 0; i < n; i++) counts[band[i] as number] = (counts[band[i] as number] as number) + 1;
  const seen = new Uint32Array(BANDS.length);
  const rank = new Float32Array(n);
  for (const i of order) {
    const b = band[i] as number;
    rank[i] = (seen[b] as number) / (counts[b] as number);
    seen[b] = (seen[b] as number) + 1;
  }
  return { band, rank, counts };
}
