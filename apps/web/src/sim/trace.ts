import { applyOverrides, type CsrLike, LIF_DEFAULTS, NET_OVERRIDES, type Net, netFromCsr } from '@fly/sim';
import type { SpikeLog } from './feed';

/** Drawn at a probe's own spike steps (the LIF model has no spike waveform, only the reset). */
export const SPIKE_MV = 20;
/** History integrated before the window: e^(−100/τm) leaves < 1% of the starting error. */
const WARMUP_MS = 100;
/** Same rest snap as the sim (lif.ts `QUIET`), so a decayed trace reads exactly vRest. */
const QUIET = 1e-4;

/** An electrode: the probed row, its inputs (pre row → signed mV) and reusable trace buffers. */
export interface Probe {
  row: number;
  inputs: Map<number, number>;
  x: Float64Array;
  y: Float64Array;
  gAdd: Float64Array;
  fire: Uint8Array;
}

/** The scenario's own sim net: same weights and literature overrides as the live worker / bake. */
export function scenarioNet(csr: CsrLike, sign: Int8Array, types: ArrayLike<string | null>): Net {
  let net = netFromCsr(csr, sign, LIF_DEFAULTS.wSyn);
  for (const o of NET_OVERRIDES) {
    try {
      net = applyOverrides(net, types, [o]);
    } catch {
      // types not in this scenario
    }
  }
  return net;
}

/** Probe on `row`; inputs come from a scan of the outgoing CSR (no transpose). */
export function probe(net: Net, row: number): Probe {
  const inputs = new Map<number, number>();
  const { offsets, cols, w } = net;
  for (let k = 0; k < net.n; k++)
    for (let e = offsets[k] as number; e < (offsets[k + 1] as number); e++)
      if (cols[e] === row) inputs.set(k, (inputs.get(k) ?? 0) + (w[e] as number));
  const empty = new Float64Array(0);
  return { row, inputs, x: empty, y: empty, gAdd: empty, fire: new Uint8Array(0) };
}

/**
 * Membrane potential of the probe over [from, to] (one sample per sim step), rebuilt from the spike log:
 * between events the LIF pair is linear (lif.ts), so input spikes (g += w after the delay) plus the probe's
 * own logged spikes (reset, refractory) reproduce the sim exactly — except for drive the log cannot show
 * (Poisson stimulus kicks, inputs from outside the scenario). Views into the probe's buffers.
 */
export function voltage(
  log: SpikeLog,
  p: Probe,
  from: number,
  to: number,
): { x: Float64Array; y: Float64Array } {
  const { dt, vRest, vReset, tauMembrane: tm, tauSyn: ts } = LIF_DEFAULTS;
  const decayM = Math.exp(-dt / tm);
  const decayS = Math.exp(-dt / ts);
  const kappa = (ts / (ts - tm)) * (decayS - decayM);
  const D = Math.round(LIF_DEFAULTS.delay / dt);
  const R = Math.round(LIF_DEFAULTS.refractory / dt);

  // step k advances the state from k·dt to (k+1)·dt
  const k0 = Math.max(0, Math.round(Math.max(log.start, from - WARMUP_MS) / dt));
  const kEnd = Math.max(k0, Math.round(to / dt));
  const first = Math.max(k0, Math.round(from / dt) - 1);
  const n = kEnd - k0;
  if (p.gAdd.length < n) {
    p.gAdd = new Float64Array(n);
    p.fire = new Uint8Array(n);
    p.x = new Float64Array(n);
    p.y = new Float64Array(n);
  }
  const { gAdd, fire, x, y, inputs, row } = p;
  gAdd.fill(0, 0, n);
  fire.fill(0, 0, n);

  // a spike logged at step s fires in step s − 1 and lands on its targets in step s + D
  const [i0, i1] = log.span((k0 - D - 0.5) * dt, (kEnd + 0.5) * dt);
  const { times, rows } = log;
  for (let i = i0; i < i1; i++) {
    const r = rows[i] as number;
    const s = Math.round((times[i] as number) / dt);
    if (r === row && s - 1 >= k0 && s - 1 < kEnd) fire[s - 1 - k0] = 1;
    const w = inputs.get(r);
    if (w !== undefined && s + D >= k0 && s + D < kEnd) gAdd[s + D - k0] = (gAdd[s + D - k0] as number) + w;
  }

  let u = 0;
  let g = 0;
  let refEnd = -1;
  let m = 0;
  for (let j = 0; j < n; j++) {
    const k = k0 + j;
    g += gAdd[j] as number;
    let spike = false;
    if (fire[j]) {
      u = vReset - vRest;
      refEnd = k + 1 + R;
      spike = true;
    } else if (k < refEnd) u = vReset - vRest;
    else u = u * decayM + g * kappa;
    g *= decayS;
    if (Math.abs(u) < QUIET && Math.abs(g) < QUIET && k + 1 >= refEnd) {
      u = 0;
      g = 0;
    }
    if (k < first) continue;
    x[m] = (k + 1) * dt;
    y[m++] = spike ? SPIKE_MV : vRest + u;
  }
  return { x: x.subarray(0, m), y: y.subarray(0, m) };
}
