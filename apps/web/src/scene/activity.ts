import type { Csr, NeuronTable } from '@fly/data';

/** "Last spike" of a row that has not fired: far enough in the past that every glow has decayed. */
export const NEVER = -1e9;

/**
 * Fake activity (until the simulator lands in phase 3): breadth-first from `seeds`, each synaptic
 * hop adds `hopMs`. Returns onset per graph row in sim ms, Infinity where never reached.
 */
export function bfsOnsets(csr: Csr, seeds: Iterable<number>, hopMs: number, minWeight = 1): Float32Array {
  const n = csr.offsets.length - 1;
  const onset = new Float32Array(n).fill(Infinity);
  let frontier: number[] = [];
  for (const s of seeds) {
    if (onset[s] === 0) continue;
    onset[s] = 0;
    frontier.push(s);
  }
  for (let hop = 1; frontier.length; hop++) {
    const next: number[] = [];
    for (const pre of frontier) {
      for (let e = csr.offsets[pre] as number; e < (csr.offsets[pre + 1] as number); e++) {
        const post = csr.cols[e] as number;
        if ((csr.weight[e] as number) < minWeight || onset[post] !== Infinity) continue;
        onset[post] = hop * hopMs;
        next.push(post);
      }
    }
    frontier = next;
  }
  return onset;
}

/** Graph rows whose cell type is one of `types`. */
export function seedRows(
  meta: Pick<NeuronTable, 'n' | 'type' | 'strings'>,
  types: readonly string[],
): number[] {
  const want = new Set(types);
  const rows: number[] = [];
  for (let i = 0; i < meta.n; i++) {
    const t = meta.strings.types[meta.type[i] as number];
    if (t !== undefined && want.has(t)) rows.push(i);
  }
  return rows;
}

/** Loop period: the last onset plus `tailMs` for its wave to play out. */
export function cycleMs(onsets: Float32Array, tailMs: number): number {
  let last = 0;
  for (const t of onsets) if (t !== Infinity && t > last) last = t;
  return last + tailMs;
}

/** Sets `out[row]` to the onset of every row that has fired by `t`, NEVER otherwise. True if anything changed. */
export function writeSpikes(onsets: Float32Array, t: number, out: Float32Array): boolean {
  let changed = false;
  for (let i = 0; i < onsets.length; i++) {
    const on = onsets[i] as number;
    const v = on <= t ? on : NEVER;
    if (out[i] !== v) {
      out[i] = v;
      changed = true;
    }
  }
  return changed;
}

/** Spreads onsets by a deterministic 0..`ms` offset per row (seeds do not all fire on the same ms). */
export function jitter(onsets: Float32Array, ms: number): Float32Array {
  return onsets.map((t, i) => t + ((Math.imul(i + 1, 0x9e3779b1) >>> 0) / 2 ** 32) * ms);
}
