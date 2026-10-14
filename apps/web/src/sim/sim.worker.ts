import { type Csr, decodeGraph, decodeMeta, SOMA_SIDES } from '@fly/data';
import {
  applyOverrides,
  type CellTable,
  type Drive,
  type Group,
  LIF_DEFAULTS,
  type LifParams,
  NET_OVERRIDES,
  type Net,
  netFromCsr,
  resolveGroups,
} from '@fly/sim';
import { expose, transfer } from 'comlink';
import { type Batch, Live, rowMap, watchRows } from './live';
import { readBytes } from './stream';

export interface LiveInit {
  /** `graph-full` and `meta-full` chunk URLs (fetched here, they never pass through the main thread). */
  graphUrl: string;
  metaUrl: string;
  /** bodyIds of the scenario rows the scene draws. */
  scenarioBodyIds: Float64Array;
  /** Decoded size of both chunks (manifest `bytes`: Content-Length is the gzip size on Pages); 0 = unknown. */
  totalBytes?: number;
  /** Scenario rows driven by Poisson input from t = 0 (the baked run's stimulus). */
  stim: number[];
  seed: number;
}

/** Sim params plus `gain`: a multiplier on synaptic weights only (the Poisson kick keeps `wSyn`). */
export type Tuning = Partial<LifParams> & { gain?: number };

let live: Live | undefined;
let stim: number[] = [];
let graph: ({ csr: Csr; sign: Int8Array } & CellTable) | undefined;
let synW: number = LIF_DEFAULTS.wSyn; // wSyn · gain the current net was built with
let bodies: Float64Array<ArrayBufferLike> = new Float64Array(0); // full-graph bodyIds by row

/** Same net as the bake (`buildNet`): Shiu weights · gain + literature overrides. */
const buildNet = (g: NonNullable<typeof graph>, w: number): Net =>
  applyOverrides(netFromCsr(g.csr, g.sign, w), g.types, NET_OVERRIDES);

const need = () => {
  if (!live) throw new Error('sim worker: init first');
  return live;
};

/** Loaded fraction 0..1 of `totalBytes`, at most every `PROGRESS_MS`; null = total unknown. */
export type Progress = (f: number | null) => void;
const PROGRESS_MS = 100;

async function bytes(url: string, onBytes: (n: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return readBytes(res, onBytes);
}

const api = {
  /** Loads the full graph and starts the scenario at t = 0; returns full-graph size. */
  async init(o: LiveInit, onProgress?: Progress): Promise<{ n: number; edges: number }> {
    const total = o.totalBytes ?? 0;
    const got: [number, number] = [0, 0];
    let last = 0;
    const tick = (i: number) => (n: number) => {
      got[i] = n;
      const now = performance.now();
      if (!onProgress || now - last < PROGRESS_MS) return;
      last = now;
      onProgress(total > 0 ? (got[0] + got[1]) / total : null);
    };
    if (onProgress) onProgress(total > 0 ? 0 : null);
    const [csr, meta] = await Promise.all([
      bytes(o.graphUrl, tick(0)).then(decodeGraph),
      bytes(o.metaUrl, tick(1)).then(decodeMeta),
    ]);
    if (onProgress) onProgress(total > 0 ? 1 : null);
    graph = {
      csr,
      sign: meta.sign,
      types: Array.from(meta.type, (t) => meta.strings.types[t] ?? null),
      sides: Array.from(meta.somaSide, (s) => SOMA_SIDES[s] ?? null),
    };
    synW = LIF_DEFAULTS.wSyn;
    bodies = meta.bodyIds;
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

  /** Full-graph rows of cell groups by type (and soma side), e.g. `SENSES` or operation targets. */
  groups<K extends string>(specs: Record<K, RegExp>): Record<K, Group> {
    if (!graph) throw new Error('sim worker: init first');
    return resolveGroups(graph, specs);
  },

  /** Full-graph rows of these bodyIds (ascending; ids outside the graph are dropped). */
  rowsOf(ids: Float64Array): Uint32Array {
    const { fullOf } = rowMap(bodies, ids);
    return Uint32Array.from(fullOf.filter((r) => r >= 0)).sort();
  },

  /** Batches report only these groups' cells from now on; returns the groups in batch rows. */
  watch<K extends string>(specs: Record<K, RegExp>): Record<K, Group> {
    const { rows, local } = watchRows(api.groups(specs));
    need().watch(rows);
    return local;
  },

  /** Poisson drive by full-graph row (a `diffDrive` batch); `reset` clears it. */
  drive(d: Drive, gain?: number) {
    need().drive(d, gain);
  },

  silenceRows(rows: Uint32Array, on = true) {
    need().silenceRows(rows, on);
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
