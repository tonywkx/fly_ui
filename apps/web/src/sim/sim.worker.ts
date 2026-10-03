import { type Csr, decodeGraph, decodeMeta } from '@fly/data';
import { applyOverrides, LIF_DEFAULTS, type LifParams, NET_OVERRIDES, type Net, netFromCsr } from '@fly/sim';
import { expose, transfer } from 'comlink';
import { type Batch, Live, rowMap } from './live';

export interface LiveInit {
  /** `graph-full` and `meta-full` chunk URLs (fetched here, they never pass through the main thread). */
  graphUrl: string;
  metaUrl: string;
  /** bodyIds of the scenario rows the scene draws. */
  scenarioBodyIds: Float64Array;
  /** Scenario rows driven by Poisson input from t = 0 (the baked run's stimulus). */
  stim: number[];
  seed: number;
}

/** Sim params plus `gain`: a multiplier on synaptic weights only (the Poisson kick keeps `wSyn`). */
export type Tuning = Partial<LifParams> & { gain?: number };

let live: Live | undefined;
let stim: number[] = [];
let graph: { csr: Csr; sign: Int8Array; types: (string | null)[] } | undefined;
let synW: number = LIF_DEFAULTS.wSyn; // wSyn · gain the current net was built with

/** Same net as the bake (`buildNet`): Shiu weights · gain + literature overrides. */
const buildNet = (g: NonNullable<typeof graph>, w: number): Net =>
  applyOverrides(netFromCsr(g.csr, g.sign, w), g.types, NET_OVERRIDES);

const need = () => {
  if (!live) throw new Error('sim worker: init first');
  return live;
};

async function bytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

const api = {
  /** Loads the full graph and starts the scenario at t = 0; returns full-graph size. */
  async init(o: LiveInit): Promise<{ n: number; edges: number }> {
    const [csr, meta] = await Promise.all([
      bytes(o.graphUrl).then(decodeGraph),
      bytes(o.metaUrl).then(decodeMeta),
    ]);
    graph = { csr, sign: meta.sign, types: Array.from(meta.type, (t) => meta.strings.types[t] ?? null) };
    synW = LIF_DEFAULTS.wSyn;
    const net = buildNet(graph, synW);
    live = new Live(net, rowMap(meta.bodyIds, o.scenarioBodyIds), { seed: o.seed });
    stim = o.stim;
    for (const r of stim) live.stimulate(r);
    return { n: net.n, edges: net.cols.length };
  },

  /** Runs `ms` more sim time; the batch's arrays are transferred, not copied. */
  advance(ms: number): Batch {
    const b = need().advance(ms);
    return transfer(b, [b.t.buffer, b.row.buffer]);
  },

  stimulate(row: number, hz?: number, gain?: number) {
    need().stimulate(row, hz, gain);
  },

  silence(row: number, on = true) {
    need().silence(row, on);
  },

  /** Restarts the scenario with new params; the net is rebuilt only when wSyn · gain changes. */
  tune({ gain = 1, ...params }: Tuning) {
    const l = need();
    const w = (params.wSyn ?? LIF_DEFAULTS.wSyn) * gain;
    const net = graph && w !== synW ? buildNet(graph, w) : undefined;
    if (net) synW = w;
    l.retune(params, net);
    for (const r of stim) l.stimulate(r);
  },

  /** Restarts the scenario: rest, t = 0, initial stimulus. */
  reset() {
    const l = need();
    l.reset();
    for (const r of stim) l.stimulate(r);
  },
};

export type SimApi = typeof api;
expose(api);
