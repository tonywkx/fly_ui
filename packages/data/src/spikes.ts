import { decodeChunk, encodeChunk } from './container';

/**
 * Baked spike train of one scenario, binned in time (CSR over bins). A spike at sim step s
 * (time s·dt) lands in bin ⌊s / stepsPerBin⌋ with sub-step s mod stepsPerBin; bins cover steps
 * 0..durationMs/dt inclusive. Ids are scenario rows (meta/graph rows of the scenario subgraph);
 * spikes of neurons outside the scenario only count towards `total`.
 */
export interface SpikeTrain {
  n: number; // scenario rows
  seed: number;
  dt: number; // ms
  durationMs: number;
  binMs: number;
  offsets: Uint32Array; // bins+1
  ids: Uint16Array | Uint32Array; // scenario row; u16 when n ≤ 65536
  sub: Uint8Array; // step within the bin
  total: Uint32Array; // per bin: spikes of the whole simulated graph
  stim: Uint32Array; // stimulated scenario rows
}

export interface SpikeTrainOptions {
  n: number;
  seed: number;
  dt: number;
  durationMs: number;
  binMs: number;
  stim: ArrayLike<number>;
}

const stepsPerBin = (s: { dt: number; binMs: number }) => Math.round(s.binMs / s.dt);
const binCount = (s: { dt: number; durationMs: number; binMs: number }) =>
  Math.floor(Math.round(s.durationMs / s.dt) / stepsPerBin(s)) + 1;

/**
 * Bins raw sim spikes (`t` ms, `id` sim index; first `count` valid) into a SpikeTrain.
 * `rowOf[id]` = scenario row or −1; events past durationMs are dropped. Each bin is sorted by (sub, row).
 */
export function spikeTrainFrom(
  spikes: { count: number; t: ArrayLike<number>; id: ArrayLike<number> },
  rowOf: Int32Array,
  o: SpikeTrainOptions,
): SpikeTrain {
  const spb = stepsPerBin(o);
  const bins = binCount(o);
  const lastStep = Math.round(o.durationMs / o.dt);
  const total = new Uint32Array(bins);
  const keys: number[][] = Array.from({ length: bins }, () => []);
  for (let k = 0; k < spikes.count; k++) {
    const step = Math.round((spikes.t[k] as number) / o.dt);
    if (step < 0 || step > lastStep) continue;
    const b = Math.floor(step / spb);
    total[b] = (total[b] as number) + 1;
    const row = rowOf[spikes.id[k] as number] ?? -1;
    if (row >= 0) (keys[b] as number[]).push((step % spb) * o.n + row);
  }
  const offsets = new Uint32Array(bins + 1);
  for (let b = 0; b < bins; b++) offsets[b + 1] = (offsets[b] as number) + (keys[b] as number[]).length;
  const m = offsets[bins] as number;
  const ids = o.n <= 0x10000 ? new Uint16Array(m) : new Uint32Array(m);
  const sub = new Uint8Array(m);
  let at = 0;
  for (const bin of keys) {
    bin.sort((a, b) => a - b);
    for (const key of bin) {
      sub[at] = Math.floor(key / o.n);
      ids[at++] = key % o.n;
    }
  }
  return {
    n: o.n,
    seed: o.seed,
    dt: o.dt,
    durationMs: o.durationMs,
    binMs: o.binMs,
    offsets,
    ids,
    sub,
    total,
    stim: Uint32Array.from(o.stim),
  };
}

function validate(s: SpikeTrain): void {
  const bins = binCount(s);
  const spb = stepsPerBin(s);
  if (spb < 1 || spb > 256) throw new Error(`spikes: ${spb} steps per bin out of range`);
  if (s.offsets.length !== bins + 1 || s.total.length !== bins)
    throw new Error(
      `spikes: expected ${bins} bins, got offsets ${s.offsets.length} / total ${s.total.length}`,
    );
  const m = s.ids.length;
  if (s.sub.length !== m || s.offsets[0] !== 0 || s.offsets[bins] !== m)
    throw new Error('spikes: offsets do not match ids/sub');
  for (let b = 0; b < bins; b++)
    if ((s.offsets[b + 1] as number) < (s.offsets[b] as number))
      throw new Error(`spikes: offsets decrease at bin ${b}`);
  for (let k = 0; k < m; k++) {
    if ((s.ids[k] as number) >= s.n) throw new Error(`spikes: row ${s.ids[k]} out of range (n=${s.n})`);
    if ((s.sub[k] as number) >= spb) throw new Error(`spikes: sub ${s.sub[k]} ≥ ${spb} steps per bin`);
  }
  for (const r of s.stim) if (r >= s.n) throw new Error(`spikes: stim row ${r} out of range`);
}

/**
 * `spikes` chunk sections: params f32 [dt, durationMs, binMs] | info u32 [n, seed] |
 * offsets u32 (bins+1) | ids u16|u32 | sub u8 | total u32 (bins) | stim u32.
 */
export function encodeSpikes(s: SpikeTrain): Uint8Array {
  validate(s);
  return encodeChunk('spikes', [
    Float32Array.of(s.dt, s.durationMs, s.binMs),
    Uint32Array.of(s.n, s.seed),
    s.offsets,
    s.ids,
    s.sub,
    s.total,
    s.stim,
  ]);
}

export function decodeSpikes(bytes: ArrayBuffer | Uint8Array): SpikeTrain {
  const { kind, sections } = decodeChunk(bytes);
  if (kind !== 'spikes') throw new Error(`expected spikes chunk, got ${kind}`);
  const [params, info, offsets, ids, sub, total, stim] = sections;
  if (
    !(params instanceof Float32Array && params.length === 3) ||
    !(info instanceof Uint32Array && info.length === 2) ||
    !(offsets instanceof Uint32Array) ||
    !(ids instanceof Uint16Array || ids instanceof Uint32Array) ||
    !(sub instanceof Uint8Array) ||
    !(total instanceof Uint32Array) ||
    !(stim instanceof Uint32Array)
  )
    throw new Error('spikes chunk: unexpected section layout');
  const s: SpikeTrain = {
    n: info[0] as number,
    seed: info[1] as number,
    dt: params[0] as number,
    durationMs: params[1] as number,
    binMs: params[2] as number,
    offsets,
    ids,
    sub,
    total,
    stim,
  };
  validate(s);
  return s;
}
