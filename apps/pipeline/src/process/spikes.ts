import { type NeuronRecord, type SpikeTrain, spikeTrainFrom } from '@fly/data';
import { createSim, type LifParams, mulberry32, type Net } from '@fly/sim';

export interface RunConfig {
  /** Every scenario neuron of these types gets Poisson input for the whole run. */
  stimTypes: string[];
  hz: number;
  durationMs: number;
  seed: number;
  binMs: number;
  params?: Partial<LifParams>;
}

export interface RunStats {
  wallMs: number;
  spikes: number;
  peakActive: number;
}

/** Full row → scenario row by bodyId, −1 outside the scenario. */
export function scenarioRows(full: NeuronRecord[], scenario: NeuronRecord[]): Int32Array {
  const local = new Map(scenario.map((r, i) => [r.bodyId, i]));
  return Int32Array.from(full, (r) => local.get(r.bodyId) ?? -1);
}

/** Runs the sim on the full net, stimulating the scenario's stimTypes; spikes binned as scenario rows. */
export function runScenario(
  net: Net,
  full: NeuronRecord[],
  rows: Int32Array,
  cfg: RunConfig,
): { train: SpikeTrain; stats: RunStats } {
  const t0 = performance.now();
  const sim = createSim(net, cfg.params, mulberry32(cfg.seed));
  const types = new Set(cfg.stimTypes);
  const stim: number[] = [];
  full.forEach((r, i) => {
    if ((rows[i] as number) < 0 || r.type === null || !types.has(r.type)) return;
    sim.stimulate(i, cfg.hz);
    stim.push(rows[i] as number);
  });
  if (!stim.length) throw new Error(`runScenario: no neurons of types ${cfg.stimTypes.join(', ')}`);
  let peakActive = 0;
  for (let ms = 0; ms < cfg.durationMs; ms++) {
    sim.run(1);
    peakActive = Math.max(peakActive, sim.activeCount);
  }
  const train = spikeTrainFrom(sim.spikes, rows, {
    n: rows.reduce((m, r) => Math.max(m, r + 1), 0),
    seed: cfg.seed,
    dt: sim.p.dt,
    durationMs: cfg.durationMs,
    binMs: cfg.binMs,
    stim: stim.sort((a, b) => a - b),
  });
  return { train, stats: { wallMs: performance.now() - t0, spikes: sim.spikes.count, peakActive } };
}

/** Mean firing rate (Hz) per type over the run; types absent from the scenario are skipped. */
export function typeRates(train: SpikeTrain, scenario: NeuronRecord[], types: string[]): Map<string, number> {
  const count = new Uint32Array(train.n);
  for (const r of train.ids) count[r] = (count[r] as number) + 1;
  const out = new Map<string, number>();
  for (const type of types) {
    let spikes = 0;
    let cells = 0;
    scenario.forEach((r, i) => {
      if (r.type !== type) return;
      cells++;
      spikes += count[i] as number;
    });
    if (cells) out.set(type, spikes / cells / (train.durationMs / 1000));
  }
  return out;
}
