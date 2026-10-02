import type { Net, Spikes } from '@fly/sim';

/** Per presynaptic neuron: Σ over its spikes (t < untilMs) of the signed weight onto `targets` (mV delivered). */
export function inputDrive(
  net: Net,
  spikes: Spikes,
  targets: ArrayLike<number>,
  untilMs = Infinity,
): Float64Array {
  const isTarget = new Uint8Array(net.n);
  for (let i = 0; i < targets.length; i++) isTarget[targets[i] as number] = 1;
  const wIn = new Float64Array(net.n); // pre → summed weight onto targets
  for (let k = 0; k < net.n; k++)
    for (let e = net.offsets[k] as number; e < (net.offsets[k + 1] as number); e++)
      if (isTarget[net.cols[e] as number]) wIn[k] = (wIn[k] as number) + (net.w[e] as number);
  const drive = new Float64Array(net.n);
  for (let s = 0; s < spikes.count; s++) {
    if ((spikes.t[s] as number) >= untilMs) continue;
    const k = spikes.id[s] as number;
    drive[k] = (drive[k] as number) + (wIn[k] as number);
  }
  return drive;
}

/** Earliest spike time (ms) among `ids`; Infinity if none fired. */
export function firstSpike(spikes: Spikes, ids: ArrayLike<number>): number {
  const want = new Set(Array.from(ids));
  let first = Number.POSITIVE_INFINITY;
  for (let s = 0; s < spikes.count; s++)
    if (want.has(spikes.id[s] as number)) first = Math.min(first, spikes.t[s] as number);
  return first;
}
