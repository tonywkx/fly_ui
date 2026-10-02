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

/** Below this |u| and |g| (mV) a neuron is snapped to rest and leaves the active set. */
const QUIET = 1e-4;

/**
 * Shiu et al. 2024 LIF: dv/dt = (v0 − v + g)/τm, dg/dt = −g/τs, presynaptic spike → g[post] += w
 * after a uniform delay. Fixed step dt with the exact exponential solution of the linear pair;
 * only neurons off rest (the active set) are integrated. Refractory: v held at reset, g still decays.
 * Stimulus = Shiu's PoissonInput: per step, Bernoulli(rate·dt) kick of wSyn·poissonScale straight into v.
 * Silenced neurons are clamped at rest: no input, no spikes (downstream ≡ Shiu's zeroed outgoing weights).
 */
export class Sim {
  readonly net: Net;
  readonly p: LifParams;
  readonly v: Float64Array; // f64: f32 ulp at −52 mV (3.8e-6) stalls the decay near rest
  readonly g: Float64Array;
  /** Last spike time per neuron (ms), −Infinity if never. */
  readonly lastSpike: Float32Array;
  readonly spikes: Spikes = { count: 0, t: new Float32Array(1024), id: new Uint32Array(1024) };

  private stepIdx = 0;
  private readonly refEnd: Int32Array; // first step index at which the neuron integrates again
  private readonly active: Uint32Array;
  private readonly isActive: Uint8Array;
  private nActive = 0;
  private readonly rng: Rng;
  private readonly stimP: Float64Array; // Poisson kick probability per step
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
  private readonly delaySteps: number;
  private readonly refSteps: number;

  constructor(net: Net, params: Partial<LifParams> = {}, rng: Rng = mulberry32(0)) {
    this.net = net;
    this.p = { ...LIF_DEFAULTS, ...params };
    const { n } = net;
    const { dt, tauMembrane: tm, tauSyn: ts } = this.p;
    this.v = new Float64Array(n).fill(this.p.vRest);
    this.g = new Float64Array(n);
    this.lastSpike = new Float32Array(n).fill(-Infinity);
    this.refEnd = new Int32Array(n);
    this.active = new Uint32Array(n);
    this.isActive = new Uint8Array(n);
    this.rng = rng;
    this.stimP = new Float64Array(n);
    this.silenced = new Uint8Array(n);
    this.decayM = Math.exp(-dt / tm);
    this.decayS = Math.exp(-dt / ts);
    this.kappa = (ts / (ts - tm)) * (this.decayS - this.decayM);
    this.delaySteps = Math.round(this.p.delay / dt);
    this.refSteps = Math.round(this.p.refractory / dt);
  }

  /** Current time, ms. */
  get t(): number {
    return this.stepIdx * this.p.dt;
  }

  get activeCount(): number {
    return this.nActive;
  }

  /** Instant g kick (mV) to neuron i, applied before the next step. */
  inject(i: number, mV: number): void {
    if (this.silenced[i]) return;
    this.g[i] = (this.g[i] as number) + mV;
    this.activate(i);
  }

  /** Poisson drive on neuron i at `hz` (0 removes it). */
  stimulate(i: number, hz: number = this.p.poissonRate): void {
    const had = (this.stimP[i] as number) > 0;
    this.stimP[i] = (hz * this.p.dt) / 1000;
    if (hz > 0 && !had) this.stimIds.push(i);
    else if (hz <= 0 && had) this.stimIds = this.stimIds.filter((j) => j !== i);
  }

  /** Clamps neuron i at rest (no input, no spikes) or releases it. */
  silence(i: number, on = true): void {
    this.silenced[i] = on ? 1 : 0;
    if (on) {
      this.v[i] = this.p.vRest;
      this.g[i] = 0;
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
    const { v, g, active, isActive, refEnd, decayM, decayS, kappa } = this;
    const { vRest, vReset, vThreshold } = this.p;
    const next = this.stepIdx + 1;
    let keep = 0;
    for (let a = 0; a < this.nActive; a++) {
      const i = active[a] as number;
      const gi = g[i] as number;
      let u: number;
      if (this.stepIdx < (refEnd[i] as number)) u = vReset - vRest;
      else {
        u = ((v[i] as number) - vRest) * decayM + gi * kappa;
        if (u >= vThreshold - vRest) {
          u = vReset - vRest;
          refEnd[i] = next + this.refSteps;
          this.fire(i, next);
        }
      }
      const gn = gi * decayS;
      if (Math.abs(u) < QUIET && Math.abs(gn) < QUIET && next >= (refEnd[i] as number)) {
        v[i] = vRest;
        g[i] = 0;
        isActive[i] = 0;
      } else {
        v[i] = vRest + u;
        g[i] = gn;
        active[keep++] = i;
      }
    }
    this.nActive = keep;
    this.stepIdx = next;
  }

  private poisson(): void {
    const { stimIds, stimP, silenced, v, rng } = this;
    const kick = this.p.wSyn * this.p.poissonScale;
    for (let k = 0; k < stimIds.length; k++) {
      const i = stimIds[k] as number;
      if (rng() >= (stimP[i] as number) || silenced[i]) continue; // draw first: rng use is state-independent
      v[i] = (v[i] as number) + kick;
      this.activate(i);
    }
  }

  private activate(i: number): void {
    if (this.isActive[i] || this.silenced[i]) return;
    this.isActive[i] = 1;
    this.active[this.nActive++] = i;
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
    const { g } = this;
    while (this.qLen > 0 && (this.qDue[this.qHead] as number) <= this.stepIdx) {
      const pre = this.qId[this.qHead] as number;
      this.qHead = (this.qHead + 1) % this.qDue.length;
      this.qLen--;
      for (let e = offsets[pre] as number; e < (offsets[pre + 1] as number); e++) {
        const post = cols[e] as number;
        if (this.silenced[post]) continue;
        g[post] = (g[post] as number) + (w[e] as number);
        this.activate(post);
      }
    }
  }
}

export function createSim(net: Net, params?: Partial<LifParams>, rng?: Rng): Sim {
  return new Sim(net, params, rng);
}
