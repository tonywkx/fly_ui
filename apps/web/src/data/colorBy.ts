import { FLAG_MALE_SPECIFIC, type NeuronTable, NONE8, NONE16, NTS } from '@fly/data';
import { CLASS_COLORS, MALE, NT_COLORS, OTHER, REGION_COLORS, type Swatch, UNKNOWN } from '../ui/palette';
import { isVnc, OPTIC, roiBase } from './bands';

/** What the neurons are tinted by (the glow/activity stays the same). */
export const COLOR_BY = ['nt', 'region', 'class', 'male'] as const;
export type ColorBy = (typeof COLOR_BY)[number];
export const isColorBy = (v: string): v is ColorBy => (COLOR_BY as readonly string[]).includes(v);
export const nextColorBy = (m: ColorBy): ColorBy =>
  COLOR_BY[(COLOR_BY.indexOf(m) + 1) % COLOR_BY.length] as ColorBy;

/** Coarse neuropil groups (hemispheres merged), signal-flow order; last = unknown. */
export const REGION_GROUPS = [
  'optic lobe',
  'central brain',
  'subesophageal zone',
  'upper tectulum',
  'lower tectulum',
  'leg neuropils',
  'abdominal',
  'other VNC',
  'unknown',
] as const;

/** Superclass groups (`class` is mostly empty in male-cns); last = unknown. */
export const CLASS_GROUPS = [
  'sensory',
  'visual',
  'central intrinsic',
  'descending',
  'VNC intrinsic',
  'ascending',
  'motor & efferent',
  'unknown',
] as const;

const SEZ = new Set(['GNG', 'SAD', 'FLA', 'PRW', 'AMMC', 'CAN']);
const UPPER_TCT = new Set(['WTct', 'HTct', 'NTct']);
const LOWER_TCT = new Set(['LTct', 'IntTct']);
const LEG = new Set(['LegNp', 'mVAC']);

/** Index into `REGION_GROUPS` for a primary ROI. */
export function regionGroup(region: string | null): number {
  const g = (label: (typeof REGION_GROUPS)[number]) => REGION_GROUPS.indexOf(label);
  if (!region) return g('unknown');
  const base = roiBase(region);
  if (OPTIC.has(base)) return g('optic lobe');
  if (SEZ.has(base)) return g('subesophageal zone');
  if (UPPER_TCT.has(base)) return g('upper tectulum');
  if (LOWER_TCT.has(base)) return g('lower tectulum');
  if (LEG.has(base)) return g('leg neuropils');
  if (base === 'ANm') return g('abdominal');
  if (isVnc(base)) return g('other VNC');
  return g('central brain');
}

/** Index into `CLASS_GROUPS` for a superclass. */
export function classGroup(superclass: string | null): number {
  const g = (label: (typeof CLASS_GROUPS)[number]) => CLASS_GROUPS.indexOf(label);
  const s = superclass ?? '';
  if (s.endsWith('_sensory') || s === 'sensory_ascending') return g('sensory');
  if (s.startsWith('visual_') || s.startsWith('ol_')) return g('visual');
  if (s === 'cb_intrinsic') return g('central intrinsic');
  if (s === 'descending_neuron') return g('descending');
  if (s === 'vnc_intrinsic') return g('VNC intrinsic');
  if (s === 'ascending_neuron' || s === 'efferent_ascending') return g('ascending');
  if (s.endsWith('_motor') || s.endsWith('_efferent')) return g('motor & efferent');
  return g('unknown');
}

export interface LegendEntry {
  label: string;
  swatch: Swatch;
  count: number;
}

export interface Coloring {
  /** Group per scenario row (index into `swatches`). */
  group: Uint8Array;
  swatches: readonly Swatch[];
  /** Groups present in the scenario: transmitters most first, other modes in group order. */
  legend: LegendEntry[];
}

const MALE_GROUPS = ['male-specific', 'other'] as const;
const UNCLEAR = NTS.indexOf('unclear');

/** Tint group of every row for a colour mode, plus the legend. */
export function colorGroups(meta: NeuronTable, mode: ColorBy): Coloring {
  const { n, strings } = meta;
  const str = (list: string[], code: number, none: number) => (code === none ? null : (list[code] ?? null));
  let labels: readonly string[];
  let swatches: readonly Swatch[];
  let of: (i: number) => number;
  switch (mode) {
    case 'nt':
      labels = NTS;
      swatches = NTS.map((nt) => NT_COLORS[nt]);
      of = (i) => {
        const c = meta.nt[i] as number;
        return c === NONE8 ? UNCLEAR : c;
      };
      break;
    case 'region':
      labels = REGION_GROUPS;
      swatches = [...REGION_COLORS, UNKNOWN];
      of = (i) => regionGroup(str(strings.regions, meta.region[i] as number, NONE16));
      break;
    case 'class':
      labels = CLASS_GROUPS;
      swatches = [...CLASS_COLORS, UNKNOWN];
      of = (i) => classGroup(str(strings.superclasses, meta.superclass[i] as number, NONE8));
      break;
    case 'male':
      labels = MALE_GROUPS;
      swatches = [MALE, OTHER];
      of = (i) => ((meta.flags[i] as number) & FLAG_MALE_SPECIFIC ? 0 : 1);
      break;
  }

  const group = new Uint8Array(n);
  const counts = new Uint32Array(labels.length);
  for (let i = 0; i < n; i++) {
    const g = of(i);
    group[i] = g;
    counts[g] = (counts[g] as number) + 1;
  }
  const legend = labels
    .map((label, g) => ({ label, swatch: swatches[g] as Swatch, count: counts[g] as number }))
    .filter((e) => e.count > 0);
  if (mode === 'nt') legend.sort((a, b) => b.count - a.count);
  return { group, swatches, legend };
}

/** Writes each row's linear rgb into a stride-4 texture array (rows past the table untouched). */
export function fillTints(out: Float32Array, { group, swatches }: Coloring) {
  for (let i = 0; i < group.length; i++) out.set((swatches[group[i] as number] as Swatch).rgb, i * 4);
}
