import { type Csr, type NeuronTable, NONE8, NONE16, NTS, type Nt } from '@fly/data';

/** Partners of one cell type on one side of the selected neuron. */
export interface PartnerGroup {
  /** null = untyped neurons (one group). */
  type: string | null;
  /** Transmitter of the strongest neuron in the group. */
  nt: Nt | null;
  /** Neurons of this type. */
  count: number;
  /** Summed synapse count. */
  synapses: number;
  /** Row of the strongest neuron of the group. */
  top: number;
}

export interface Partners {
  inputs: PartnerGroup[];
  outputs: PartnerGroup[];
}

/** Focus role per row, as written into the scene's row-state texture. */
export const ROLE = { context: 0, selected: 1, input: 2, output: 3, both: 4 } as const;

/** Inputs and outputs of `row`, grouped by cell type, strongest first. Inputs scan the CSR (no transpose). */
export function partners(csr: Csr, meta: NeuronTable, row: number): Partners {
  const { offsets, cols, weight } = csr;
  const n = offsets.length - 1;
  const inW = new Map<number, number>();
  for (let k = 0; k < n; k++) {
    if (k === row) continue;
    const i = find(cols, offsets[k] as number, offsets[k + 1] as number, row);
    if (i >= 0) inW.set(k, weight[i] as number);
  }
  const outW = new Map<number, number>();
  for (let i = offsets[row] as number; i < (offsets[row + 1] as number); i++) {
    const c = cols[i] as number;
    if (c !== row) outW.set(c, weight[i] as number);
  }
  return { inputs: group(inW, meta), outputs: group(outW, meta) };
}

/** Role of every row relative to `row` (selected / input / output / both / context). */
export function focusRoles(csr: Csr, row: number): Uint8Array {
  const { offsets, cols } = csr;
  const n = offsets.length - 1;
  const roles = new Uint8Array(n);
  for (let k = 0; k < n; k++)
    if (find(cols, offsets[k] as number, offsets[k + 1] as number, row) >= 0) roles[k] = ROLE.input;
  for (let i = offsets[row] as number; i < (offsets[row + 1] as number); i++) {
    const c = cols[i] as number;
    roles[c] = roles[c] === ROLE.input ? ROLE.both : ROLE.output;
  }
  roles[row] = ROLE.selected;
  return roles;
}

/** Binary search for `x` in the sorted `cols[lo..hi)`; −1 if absent. */
function find(cols: Uint32Array, lo: number, hi: number, x: number): number {
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const c = cols[mid] as number;
    if (c === x) return mid;
    if (c < x) lo = mid + 1;
    else hi = mid;
  }
  return -1;
}

function group(w: Map<number, number>, meta: NeuronTable): PartnerGroup[] {
  const groups = new Map<number, PartnerGroup & { topW: number }>();
  for (const [r, syn] of w) {
    const code = meta.type[r] as number;
    let g = groups.get(code);
    if (!g) {
      g = {
        type: code === NONE16 ? null : (meta.strings.types[code] ?? null),
        nt: null,
        count: 0,
        synapses: 0,
        top: r,
        topW: -1,
      };
      groups.set(code, g);
    }
    g.count++;
    g.synapses += syn;
    if (syn > g.topW || (syn === g.topW && r < g.top)) {
      g.topW = syn;
      g.top = r;
      const nt = meta.nt[r] as number;
      g.nt = nt === NONE8 ? null : (NTS[nt] ?? null);
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.synapses - a.synapses || a.top - b.top)
    .map(({ topW: _, ...g }) => g);
}
