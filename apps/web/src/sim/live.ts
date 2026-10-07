import { createSim, type Drive, type Group, type LifParams, mulberry32, type Net, type Sim } from '@fly/sim';

/** Spikes of one `advance`: scenario rows, time-ordered; `until` = sim time reached; `total` = whole-graph spikes. */
export interface Batch {
  t: Float32Array;
  row: Uint32Array;
  until: number;
  total: number;
}

export interface RowMap {
  /** Full-graph row → scenario row, −1 outside the scenario. */
  rowOf: Int32Array;
  /** Scenario row → full-graph row (−1 if the body is missing from the full graph). */
  fullOf: Int32Array;
}

/** Joins full and scenario neuron tables on bodyId (same rule as the pipeline's `scenarioRows`). */
export function rowMap(fullBodyIds: Float64Array, scenarioBodyIds: Float64Array): RowMap {
  const local = new Map(Array.from(scenarioBodyIds, (id, i) => [id, i] as const));
  const rowOf = new Int32Array(fullBodyIds.length);
  const fullOf = new Int32Array(scenarioBodyIds.length).fill(-1);
  fullBodyIds.forEach((id, i) => {
    const r = local.get(id) ?? -1;
    rowOf[i] = r;
    if (r >= 0) fullOf[r] = i;
  });
  return { rowOf, fullOf };
}

/** Row map that reports exactly `rows` (full graph) as batch rows 0…k−1. */
export function watchMap(n: number, rows: Uint32Array): RowMap {
  const rowOf = new Int32Array(n).fill(-1);
  rows.forEach((i, k) => {
    rowOf[i] = k;
  });
  return { rowOf, fullOf: Int32Array.from(rows) };
}

/** Union of the groups' rows (sorted) and the groups re-indexed into it, i.e. as batch rows after `watch`. */
export function watchRows<K extends string>(
  groups: Record<K, Group>,
): { rows: Uint32Array; local: Record<K, Group> } {
  const all = new Set<number>();
  for (const g of Object.values<Group>(groups)) for (const i of g.all) all.add(i);
  const rows = Uint32Array.from([...all].sort((a, b) => a - b));
  const at = new Map(Array.from(rows, (i, k) => [i, k] as const));
  const map = (a: Uint32Array) => a.map((i) => at.get(i) as number);
  const local = {} as Record<K, Group>;
  for (const k of Object.keys(groups) as K[]) {
    const g = groups[k];
    local[k] = { all: map(g.all), L: map(g.L), R: map(g.R) };
  }
  return { rows, local };
}

export interface LiveOptions {
  seed: number;
  params?: Partial<LifParams>;
}

/** Endless full-graph sim seen through a scenario: control by scenario row, spikes out as scenario rows. */
export class Live {
  private sim: Sim;

  constructor(
    private net: Net,
    private rows: RowMap,
    private opts: LiveOptions,
  ) {
    this.sim = this.create();
  }

  advance(ms: number): Batch {
    const { sim } = this;
    sim.run(ms);
    const { count, t, id } = sim.spikes;
    let m = 0;
    for (let k = 0; k < count; k++) if ((this.rows.rowOf[id[k] as number] as number) >= 0) m++;
    const out = { t: new Float32Array(m), row: new Uint32Array(m), until: sim.t, total: count };
    m = 0;
    for (let k = 0; k < count; k++) {
      const r = this.rows.rowOf[id[k] as number] as number;
      if (r < 0) continue;
      out.t[m] = t[k] as number;
      out.row[m++] = r;
    }
    sim.clearSpikes();
    return out;
  }

  /** Poisson drive at `hz` on a scenario row (0 removes it), kicks scaled by `gain`. */
  stimulate(row: number, hz?: number, gain?: number): void {
    const i = this.full(row);
    if (i >= 0) this.sim.stimulate(i, hz, gain);
  }

  silence(row: number, on = true): void {
    const i = this.full(row);
    if (i >= 0) this.sim.silence(i, on);
  }

  /** Poisson drive by full-graph row (0 Hz removes it), kicks scaled by `gain`. */
  drive(d: Drive, gain?: number): void {
    d.rows.forEach((i, k) => {
      this.sim.stimulate(i, d.hz[k], gain);
    });
  }

  silenceRows(rows: Uint32Array, on = true): void {
    for (const i of rows) this.sim.silence(i, on);
  }

  /** From now on batches report exactly these full-graph rows (as rows 0…k−1); the sim keeps running. */
  watch(rows: Uint32Array): void {
    this.rows = watchMap(this.rows.rowOf.length, rows);
  }

  inject(row: number, mV: number): void {
    const i = this.full(row);
    if (i >= 0) this.sim.inject(i, mV);
  }

  /** Back to rest at t = 0, same seed; stimulus and silencing are cleared. */
  reset(): void {
    this.sim = this.create();
  }

  /** New params (and net, e.g. rescaled weights), then `reset()`. */
  retune(params: Partial<LifParams>, net?: Net): void {
    this.opts = { ...this.opts, params };
    if (net) this.net = net;
    this.reset();
  }

  private full(row: number): number {
    return this.rows.fullOf[row] ?? -1;
  }

  private create(): Sim {
    return createSim(this.net, this.opts.params, mulberry32(this.opts.seed));
  }
}
