import { Kernel } from './kernel';

// Terrarium bridge: what the fly senses → Poisson drive on sensory rows; command-neuron spikes → action.
// Groups, rates and thresholds come from the 8.1 feasibility runs (docs/TERRARIUM.md).

export type Side = 'L' | 'R';
export type Sided = Record<Side, number>;

/** Sensory groups (male-cns:v1.0 types; LB3 = sugar, LB1 = bitter are proxies). Sided ones carry somaSide. */
export const SENSES = {
  sugar: /^LB3[a-d]?$/,
  bitter: /^LB1/,
  loom: /^(LC4|LPLC2)$/,
  female: /^LC10a$/,
} as const;

/** Command read-outs: TTMn → jump, MDN → back off, MN9 → eat, pIP10 → court (gated by the P1/pC1 pool). */
export const COMMANDS = {
  jump: /^TTMn$/,
  back: /^MDN$/,
  eat: /^MN9$/,
  court: /^pIP10$/,
  gate: /^pC1/,
} as const;

/** Surgeon operations: target cells and what the switch does to them. */
export const OPERATIONS = {
  panic: { types: /^DNp01$/, mode: 'off' },
  moon: { types: /^MDN$/, mode: 'on' },
  sugar: { types: SENSES.sugar, mode: 'off' },
  p1: { types: COMMANDS.gate, mode: 'off' },
} as const;

/** Poisson rate (Hz) of a fully sensed stimulus, as in 8.1. */
export const SENSE_HZ = 150;

/** Rows of one group: all cells, and by soma side (cells without a side are only in `all`). */
export interface Group {
  all: Uint32Array;
  L: Uint32Array;
  R: Uint32Array;
}

export interface CellTable {
  types: readonly (string | null)[];
  sides: readonly (string | null)[];
}

export function resolveGroups<K extends string>(
  cells: CellTable,
  specs: Record<K, RegExp>,
): Record<K, Group> {
  const out = {} as Record<K, Group>;
  for (const k of Object.keys(specs) as K[]) {
    const re = specs[k];
    const all: number[] = [];
    const L: number[] = [];
    const R: number[] = [];
    cells.types.forEach((t, i) => {
      if (t === null || !re.test(t)) return;
      all.push(i);
      const s = cells.sides[i];
      if (s === 'L') L.push(i);
      else if (s === 'R') R.push(i);
    });
    out[k] = { all: Uint32Array.from(all), L: Uint32Array.from(L), R: Uint32Array.from(R) };
  }
  return out;
}

/** What the fly senses now, each 0…1; loom and female per eye. */
export interface Senses {
  sugar: number;
  bitter: number;
  loom: Sided;
  female: Sided;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Per-eye intensity of a stimulus at `bearing` (rad from the heading, + = left): the near eye gets `x`,
 * the far eye at least `3x/4` (ahead/behind: both `x`). One eye alone is too weak in the model (8.3
 * calibration: loom one side → TTMn ≤ 187 Hz, no jump; female one side → MDN bursts, late courtship;
 * far eye ½ → loom from the right misses on some seeds, LC4 R has fewer cells).
 */
export function eyes(bearing: number, x: number): Sided {
  const s = Math.sin(bearing);
  return { L: x * (1 - Math.max(0, -s) / 4), R: x * (1 - Math.max(0, s) / 4) };
}

/** Row → Poisson Hz for the sensed stimuli; rows not driven are absent. */
export function senseDrive(
  s: Senses,
  g: Record<keyof typeof SENSES, Group>,
  hz = SENSE_HZ,
): Map<number, number> {
  const d = new Map<number, number>();
  const put = (rows: Uint32Array, x: number) => {
    const r = clamp01(x) * hz;
    if (r > 0) for (const i of rows) d.set(i, r);
  };
  put(g.sugar.all, s.sugar);
  put(g.bitter.all, s.bitter);
  for (const side of ['L', 'R'] as const) {
    put(g.loom[side], s.loom[side]);
    put(g.female[side], s.female[side]);
  }
  return d;
}

/** Batch of `stimulate(row, hz)` calls; transferable. */
export interface Drive {
  rows: Uint32Array;
  hz: Float32Array;
}

/** Only what changed from `prev` to `next`; rows that dropped out go to 0 Hz. */
export function diffDrive(prev: Map<number, number>, next: Map<number, number>): Drive {
  const rows: number[] = [];
  const hz: number[] = [];
  for (const [i, r] of next)
    if (prev.get(i) !== r) {
      rows.push(i);
      hz.push(r);
    }
  for (const i of prev.keys())
    if (!next.has(i)) {
      rows.push(i);
      hz.push(0);
    }
  return { rows: Uint32Array.from(rows), hz: Float32Array.from(hz) };
}

export type Command = keyof typeof COMMANDS;
/** Mean rate (Hz per cell) of each command group. */
export type Rates = Record<Command, number>;

/** Kernel time constants (sim ms): jump as in FlyCam's `Behavior`, the rest smoother. */
const TAU: Rates = { jump: 20, back: 40, eat: 40, court: 120, gate: 120 };
const NAMES = Object.keys(COMMANDS) as Command[];

/** Running per-cell rate of each command group from spike batches (rows in the batch's own indexing). */
export class CommandMeter {
  private readonly of = new Map<number, number>();
  private readonly n: number[];
  private k: Kernel[] = [];

  constructor(groups: Record<Command, Group>) {
    this.n = NAMES.map((c, j) => {
      for (const i of groups[c].all) this.of.set(i, j);
      return groups[c].all.length;
    });
    this.reset();
  }

  add(b: { t: ArrayLike<number>; row: ArrayLike<number> }): void {
    for (let s = 0; s < b.row.length; s++) {
      const j = this.of.get(b.row[s] as number);
      if (j !== undefined) this.k[j]?.add(b.t[s] as number);
    }
  }

  rates(t: number): Rates {
    const r = {} as Rates;
    NAMES.forEach((c, j) => {
      r[c] = (this.k[j] as Kernel).hz(t, this.n[j] as number);
    });
    return r;
  }

  reset(): void {
    this.k = NAMES.map((c) => new Kernel(TAU[c]));
  }
}

export type Action = 'walk' | 'jump' | 'back' | 'eat' | 'court';

/**
 * Enter at `on`, hold the current action down to `off` (kernel Hz per cell). Peaks in the 8.3 closed
 * loop (docs/TERRARIUM.md): loom → TTMn ≥ 204, panic neuron off ≤ 134; bitter → MDN ≥ 129, female ≤ 45;
 * sugar → MN9 ≥ 249, female/odor ≤ 104; female → pC1 ≥ 16, P1 off → 0 (pIP10 alone stays high).
 */
export const THRESHOLDS: Record<Command, { on: number; off: number }> = {
  jump: { on: 170, off: 110 },
  back: { on: 60, off: 35 },
  eat: { on: 150, off: 100 },
  court: { on: 50, off: 30 },
  gate: { on: 3, off: 1.5 },
};

/**
 * MDN rate that breaks off eating or courting. Under sustained sugar / female drive MDN creeps up to
 * 47–91 Hz after 450–600 ms (8.5 live loop; the 300 ms calibration missed it) — not a reason to back off.
 */
export const PREEMPT_BACK = 150;

/** Action from command rates; priority jump > back > eat > court (an ongoing eat/court needs `PREEMPT_BACK`), else the scripted walk. */
export function decide(r: Rates, prev: Action): Action {
  const over = (c: Command, held: boolean) => r[c] >= THRESHOLDS[c][held ? 'off' : 'on'];
  if (over('jump', prev === 'jump')) return 'jump';
  const busy = prev === 'eat' || prev === 'court';
  if (busy ? r.back >= PREEMPT_BACK : over('back', prev === 'back')) return 'back';
  if (over('eat', prev === 'eat')) return 'eat';
  const court = prev === 'court';
  return over('court', court) && over('gate', court) ? 'court' : 'walk';
}
