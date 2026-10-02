import { createSim, type LifParams, mulberry32, type Net, type Sim } from '@fly/sim';

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
  const local = new Map<number, number>();
  scenarioBodyIds.forEach((id, i) => local.set(id, i));
  const rowOf = new Int32Array(fullBodyIds.length);
  const fullOf = new Int32Array(scenarioBodyIds.length).fill(-1);
  fullBodyIds.forEach((id, i) => {
    const r = local.get(id) ?? -1;
    rowOf[i] = r;
    if (r >= 0) fullOf[r] = i;
  });
  return { rowOf, fullOf };
}

export interface LiveOptions {
  seed: number;
  params?: Partial<LifParams>;
}

/** Endless full-graph sim seen through a scenario: control by scenario row, spikes out as scenario rows. */
export class Live {
  private sim: Sim;

  constructor(
    private readonly net: Net,
    private readonly rows: RowMap,
    private readonly opts: LiveOptions,
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

  /** Poisson drive at `hz` on a scenario row (0 removes it). */
  stimulate(row: number, hz?: number): void {
    const i = this.full(row);
    if (i >= 0) this.sim.stimulate(i, hz);
  }

  silence(row: number, on = true): void {
    const i = this.full(row);
    if (i >= 0) this.sim.silence(i, on);
  }

  inject(row: number, mV: number): void {
    const i = this.full(row);
    if (i >= 0) this.sim.inject(i, mV);
  }

  /** Back to rest at t = 0, same seed; stimulus and silencing are cleared. */
  reset(): void {
    this.sim = this.create();
  }

  private full(row: number): number {
    return this.rows.fullOf[row] ?? -1;
  }

  private create(): Sim {
    return createSim(this.net, this.opts.params, mulberry32(this.opts.seed));
  }
}
