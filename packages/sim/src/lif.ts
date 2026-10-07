import type { Net } from './net';
import { LIF_DEFAULTS } from './params';
import { mulberry32, type Rng } from './rng';

export type LifParams = { -readonly [K in keyof typeof LIF_DEFAULTS]: number };

/** Growable spike log; valid entries are [0, count). */
export interface Spikes {
  count: number;
  t: Float32Array; // ms
  id: Uint32Array;
}

/** Below this |u| and |g| (mV) a decayed neuron is snapped to rest. */
const QUIET = 1e-4;
/** Decay powers dMⁿ, dSⁿ are tabled up to this many steps; longer gaps use Math.pow. */
const TABLE = 1 << 14;

/**
 * Shiu et al. 2024 LIF: dv/dt = (v0 − v + g)/τm, dg/dt = −g/τs, presynaptic spike → g[post] += w
 * after a uniform delay. Fixed step dt with the exact exponential solution of the linear pair.
 * Refractory: v held at reset, g still decays.
 * Stimulus = Shiu's PoissonInput: per step, Bernoulli(rate·dt) kick of wSyn·poissonScale straight into v.
 * Silenced neurons are clamped at rest: no input, no spikes (downstream ≡ Shiu's zeroed outgoing weights).
 *
 * Lazy integration: only neurons that could reach threshold without further input (u⁺ + g⁺·peak of
 * the PSP kernel) or are refractory are stepped (the active set). The rest decay in closed form when
 * the next input touches them — the same exact solution, n steps at once. Same spikes as stepping all.
 */
export class Sim {
  readonly net: Net;
  readonly p: LifParams;
  /** Last spike time per neuron (ms), −Infinity if never. */
  readonly lastSpike: Float32Array;
  readonly spikes: Spikes = { count: 0, t: new Float32Array(1024), id: new Uint32Array(1024) };

  // f64: f32 ulp at −52 mV (3.8e-6) stalls the decay near rest. u = v − vRest; valid as of step `last`
  // for neurons outside the active set, as of now inside it.
  private readonly u: Float64Array;
  private readonly g: Float64Array;
  private readonly last: Int32Array;
  private stepIdx = 0;
  private readonly refEnd: Int32Array; // first step index at which the neuron integrates again
  private readonly active: Uint32Array;
  private readonly isActive: Uint8Array;
  private nActive = 0;
  private readonly rng: Rng;
  private readonly stimP: Float64Array; // Poisson kick probability per step
  private readonly stimK: Float32Array; // Poisson kick gain per neuron
  private stimIds: number[] = [];
  private readonly silenced: Uint8Array;
  // delay FIFO (uniform delay → due steps are monotone): ring of (due step, pre id)
  private qDue = new Int32Array(1024);
  private qId = new Uint32Array(1024);
  private qHead = 0;
  private qLen = 0;

  private readonly decayM: number;
  private readonly decayS: number;
  private readonly kappa: number;
  /** u after n input-free steps = (u + c·g)·dMⁿ − c·g·dSⁿ. */
  private readonly c: number;
  /** Peak of the PSP kernel per mV of g: input-free u never exceeds u⁺ + peak·g⁺. */
  private readonly peak: number;
  private readonly powM: Float64Array;
  private readonly powS: Float64Array;
  private readonly theta: number; // threshold above rest
  private readonly delaySteps: number;
  private readonly refSteps: number;

  constructor(net: Net, params: Partial<LifParams> = {}, rng: Rng = mulberry32(0)) {
    this.net = net;
    this.p = { ...LIF_DEFAULTS, ...params };
    const { n } = net;
    const { dt, tauMembrane: tm, tauSyn: ts } = this.p;
    this.u = new Float64Array(n);
    this.g = new Float64Array(n);
    this.last = new Int32Array(n);
    this.lastSpike = new Float32Array(n).fill(-Infinity);
    this.refEnd = new Int32Array(n);
    this.active = new Uint32Array(n);
    this.isActive = new Uint8Array(n);
    this.rng = rng;
    this.stimP = new Float64Array(n);
    this.stimK = new Float32Array(n);
    this.silenced = new Uint8Array(n);
    this.decayM = Math.exp(-dt / tm);
    this.decayS = Math.exp(-dt / ts);
    this.kappa = (ts / (ts - tm)) * (this.decayS - this.decayM);
    this.c = this.kappa / (this.decayM - this.decayS);
    const tPeak = (Math.log(tm / ts) * tm * ts) / (tm - ts);
    this.peak = (ts / (tm - ts)) * (Math.exp(-tPeak / tm) - Math.exp(-tPeak / ts)) * (1 + 1e-9);
    this.powM = new Float64Array(TABLE);
    this.powS = new Float64Array(TABLE);
    for (let k = 0; k < TABLE; k++) {
      this.powM[k] = this.decayM ** k;
      this.powS[k] = this.decayS ** k;
    }
    this.theta = this.p.vThreshold - this.p.vRest;
    this.delaySteps = Math.round(this.p.delay / dt);
    this.refSteps = Math.round(this.p.refractory / dt);
  }

  /** Current time, ms. */
  get t(): number {
    return this.stepIdx * this.p.dt;
  }

  /** Neurons stepped one by one right now (could fire without new input, or refractory). */
  get activeCount(): number {
    return this.nActive;
  }

  /** Membrane potential of neuron i now (mV). */
  voltage(i: number): number {
    return this.p.vRest + this.now(i)[0];
  }

  /** Synaptic conductance term g of neuron i now (mV). */
  conductance(i: number): number {
    return this.now(i)[1];
  }

  /** Instant g kick (mV) to neuron i, applied before the next step. */
  inject(i: number, mV: number): void {
    if (this.silenced[i]) return;
    this.touch(i);
    this.g[i] = (this.g[i] as number) + mV;
    this.wake(i);
  }

  /** Poisson drive on neuron i at `hz` (0 removes it), kicks scaled by `gain`. */
  stimulate(i: number, hz: number = this.p.poissonRate, gain = 1): void {
    const had = (this.stimP[i] as number) > 0;
    this.stimP[i] = (hz * this.p.dt) / 1000;
    this.stimK[i] = gain;
    if (hz > 0 && !had) this.stimIds.push(i);
    else if (hz <= 0 && had) this.stimIds = this.stimIds.filter((j) => j !== i);
  }

  /** Clamps neuron i at rest (no input, no spikes) or releases it. */
  silence(i: number, on = true): void {
    this.silenced[i] = on ? 1 : 0;
    if (on) {
      this.u[i] = 0;
      this.g[i] = 0;
      this.last[i] = this.stepIdx;
    }
  }

  /** Empties the spike log (keeps its capacity); the caller reads it first. Dynamics are unaffected. */
  clearSpikes(): void {
    this.spikes.count = 0;
  }

  run(ms: number): void {
    const steps = Math.round(ms / this.p.dt);
    for (let k = 0; k < steps; k++) this.step();
  }

  step(): void {
    this.deliver();
    this.poisson();
    const { u, g, active, isActive, refEnd, last, decayM, decayS, kappa, peak, theta } = this;
    const reset = this.p.vReset - this.p.vRest;
    const next = this.stepIdx + 1;
    let keep = 0;
    for (let a = 0; a < this.nActive; a++) {
      const i = active[a] as number;
      const gi = g[i] as number;
      let ui: number;
      if (this.stepIdx < (refEnd[i] as number)) ui = reset;
      else {
        ui = (u[i] as number) * decayM + gi * kappa;
        if (ui >= theta) {
          ui = reset;
          refEnd[i] = next + this.refSteps;
          this.fire(i, next);
        }
      }
      const gn = gi * decayS;
      u[i] = ui;
      g[i] = gn;
      if (next >= (refEnd[i] as number) && Math.max(ui, 0) + peak * Math.max(gn, 0) < theta) {
        isActive[i] = 0;
        last[i] = next;
      } else active[keep++] = i;
    }
    this.nActive = keep;
    this.stepIdx = next;
  }

  /** (u, g) of neuron i now, without changing its stored state. */
  private now(i: number): [number, number] {
    const n = this.isActive[i] ? 0 : this.stepIdx - (this.last[i] as number);
    return this.decay(this.u[i] as number, this.g[i] as number, n);
  }

  /** Input-free (u, g) after n steps (closed form of the step), snapped to rest below QUIET. */
  private decay(u: number, g: number, n: number): [number, number] {
    if (n === 0 || (u === 0 && g === 0)) return [u, g];
    const pm = n < TABLE ? (this.powM[n] as number) : this.decayM ** n;
    const ps = n < TABLE ? (this.powS[n] as number) : this.decayS ** n;
    const cg = this.c * g;
    const u2 = (u + cg) * pm - cg * ps;
    const g2 = g * ps;
    return Math.abs(u2) < QUIET && Math.abs(g2) < QUIET ? [0, 0] : [u2, g2];
  }

  /** Brings a lazy neuron's stored state up to now before an input lands on it (decay, allocation-free). */
  private touch(i: number): void {
    if (this.isActive[i]) return;
    const n = this.stepIdx - (this.last[i] as number);
    if (n === 0) return;
    this.last[i] = this.stepIdx;
    const u = this.u[i] as number;
    const g = this.g[i] as number;
    if (u === 0 && g === 0) return;
    const pm = n < TABLE ? (this.powM[n] as number) : this.decayM ** n;
    const ps = n < TABLE ? (this.powS[n] as number) : this.decayS ** n;
    const cg = this.c * g;
    const u2 = (u + cg) * pm - cg * ps;
    const g2 = g * ps;
    const quiet = Math.abs(u2) < QUIET && Math.abs(g2) < QUIET;
    this.u[i] = quiet ? 0 : u2;
    this.g[i] = quiet ? 0 : g2;
  }

  /** Into the active set if neuron i (touched, current) could now reach threshold on its own. */
  private wake(i: number): void {
    if (this.isActive[i] || this.silenced[i]) return;
    const u = this.u[i] as number;
    const g = this.g[i] as number;
    if (Math.max(u, 0) + this.peak * Math.max(g, 0) < this.theta) return;
    this.isActive[i] = 1;
    this.active[this.nActive++] = i;
  }

  private poisson(): void {
    const { stimIds, stimP, stimK, silenced, u, rng } = this;
    const kick = this.p.wSyn * this.p.poissonScale;
    for (let k = 0; k < stimIds.length; k++) {
      const i = stimIds[k] as number;
      if (rng() >= (stimP[i] as number) || silenced[i]) continue; // draw first: rng use is state-independent
      this.touch(i);
      u[i] = (u[i] as number) + kick * (stimK[i] as number);
      this.wake(i);
    }
  }

  private fire(i: number, step: number): void {
    const time = step * this.p.dt;
    this.lastSpike[i] = time;
    const s = this.spikes;
    if (s.count === s.t.length) {
      const t = new Float32Array(s.count * 2);
      const id = new Uint32Array(s.count * 2);
      t.set(s.t);
      id.set(s.id);
      s.t = t;
      s.id = id;
    }
    s.t[s.count] = time;
    s.id[s.count] = i;
    s.count++;
    this.enqueue(step + this.delaySteps, i);
  }

  private enqueue(due: number, i: number): void {
    const cap = this.qDue.length;
    if (this.qLen === cap) {
      const due2 = new Int32Array(cap * 2);
      const id2 = new Uint32Array(cap * 2);
      for (let k = 0; k < this.qLen; k++) {
        const j = (this.qHead + k) % cap;
        due2[k] = this.qDue[j] as number;
        id2[k] = this.qId[j] as number;
      }
      this.qDue = due2;
      this.qId = id2;
      this.qHead = 0;
    }
    const j = (this.qHead + this.qLen) % this.qDue.length;
    this.qDue[j] = due;
    this.qId[j] = i;
    this.qLen++;
  }

  /** Applies every queued spike due at the current step to its targets' g. */
  private deliver(): void {
    const { offsets, cols, w } = this.net;
    const { g, silenced } = this;
    while (this.qLen > 0 && (this.qDue[this.qHead] as number) <= this.stepIdx) {
      const pre = this.qId[this.qHead] as number;
      this.qHead = (this.qHead + 1) % this.qDue.length;
      this.qLen--;
      for (let e = offsets[pre] as number; e < (offsets[pre + 1] as number); e++) {
        const post = cols[e] as number;
        if (silenced[post]) continue;
        this.touch(post);
        g[post] = (g[post] as number) + (w[e] as number);
        this.wake(post);
      }
    }
  }
}

export function createSim(net: Net, params?: Partial<LifParams>, rng?: Rng): Sim {
  return new Sim(net, params, rng);
}
