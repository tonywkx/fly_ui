import { type NeuronTable, NONE8, NONE16 } from '@fly/data';

export interface TypeEntry {
  type: string;
  /** Scenario rows of this type, ascending. */
  rows: number[];
  /** Superclass of the first row (types do not straddle superclasses). */
  superclass: string | null;
}

/** Cell types of the scenario for search, by name ignoring case; untyped rows are left out. */
export function typeIndex(meta: NeuronTable): TypeEntry[] {
  const { strings } = meta;
  const byCode = new Map<number, TypeEntry>();
  for (let i = 0; i < meta.n; i++) {
    const t = meta.type[i] as number;
    if (t === NONE16) continue;
    let e = byCode.get(t);
    if (!e) {
      const s = meta.superclass[i] as number;
      e = {
        type: strings.types[t] as string,
        rows: [],
        superclass: s === NONE8 ? null : (strings.superclasses[s] ?? null),
      };
      byCode.set(t, e);
    }
    e.rows.push(i);
  }
  return [...byCode.values()].sort((a, b) => a.type.localeCompare(b.type, 'en', { sensitivity: 'base' }));
}

/** Rows whose bodyId starts with `digits` (row order), at most `limit`; [] unless all digits. */
export function findBodyIds(meta: NeuronTable, digits: string, limit: number): number[] {
  if (!/^\d+$/.test(digits)) return [];
  const out: number[] = [];
  for (let i = 0; i < meta.n && out.length < limit; i++)
    if (String(meta.bodyIds[i]).startsWith(digits)) out.push(i);
  return out;
}
