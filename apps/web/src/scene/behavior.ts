import { NONE16 } from '@fly/data';
import type { SpikeLog } from '@/sim/feed';

/** Which body part a motor neuron moves. */
export const EFFECTOR = { none: 0, jump: 1, proboscis: 2, wing: 3 } as const;
export type Effector = (typeof EFFECTOR)[keyof typeof EFFECTOR];

/** Tergotrochanteral MN: the jump muscle (escape). */
const JUMP = /^TTMn$/;
/** Proboscis extension (sugar, Shiu 2024). */
const PROBOSCIS = /^MN9$/;
/** Direct wing steering MNs that pIP10 drives during song (hg1–4, ps1, b1–3, i1–2, iii1–3, tp1–2). */
const WING = /^(hg\d|ps\d|b\d|i\d|iii\d|tp\d) MN$/;

/** Kernel time constants (sim ms) of the per-effector rate estimates. */
const TAU = { jump: 20, proboscis: 40, wing: 50 };
/**
 * Mean TTMn rate (Hz, kernel estimate) that launches a jump; one lone spike reads 50. Escape: crossed
 * at ≈30 ms (peak ≈290); Giant Fiber silenced: a brief TTMn burst peaks at ≈176 (live) → no jump.
 */
const JUMP_HZ = 200;
/** Below this the TTMn are quiet; quiet for `REARM_MS` after landing → the fly is back. */
const REARM_HZ = 20;
const REARM_MS = 150;
/** Takeoff to out of frame, sim ms (the camera is high-speed: sim time, not wall time). */
const JUMP_MS = 60;
/** Rate (Hz) of full extension. */
const PROBOSCIS_HZ = 80;
const WING_HZ = 8;
/** Decay of one wing flick (a spike), sim ms. */
const FLICK_MS = 3;

export interface FlyPose {
  /** Sim time of takeoff, null while standing. */
  jumpAt: number | null;
  /** 0 standing … 1 out of frame. */
  lift: number;
  /** 0 retracted … 1 extended. */
  proboscis: number;
  /** 0 folded … 1 held out (song). */
  wing: number;
  /** 1 at a wing MN spike, decays fast. */
  flick: number;
}

interface MetaTypes {
  n: number;
  type: Uint16Array;
  strings: { types: string[] };
}

/** Effector per row by cell type. */
export function effectorMask(meta: MetaTypes): Uint8Array {
  const byType = meta.strings.types.map((t) =>
    JUMP.test(t)
      ? EFFECTOR.jump
      : PROBOSCIS.test(t)
        ? EFFECTOR.proboscis
        : WING.test(t)
          ? EFFECTOR.wing
          : EFFECTOR.none,
  );
  const mask = new Uint8Array(meta.n);
  for (let i = 0; i < meta.n; i++) {
    const t = meta.type[i] as number;
    if (t !== NONE16) mask[i] = byType[t] ?? EFFECTOR.none;
  }
  return mask;
}

/** Exponential spike kernel: `s` = Σ exp(−age/τ) as of time `at`. */
class Kernel {
  s = 0;
  at = 0;
  constructor(private readonly tau: number) {}

  value(t: number): number {
    return this.s * Math.exp(-(t - this.at) / this.tau);
  }

  add(t: number): void {
    this.s = this.value(t) + 1;
    this.at = t;
  }

  /** Mean rate (Hz) per neuron of `n`, at `t`. */
  hz(t: number, n: number): number {
    return n ? (this.value(t) / (n * this.tau)) * 1000 : 0;
  }

  /** When the rate fell (or will fall) below `hz`, given no further spikes. */
  below(hz: number, n: number): number {
    const thr = (hz * n * this.tau) / 1000;
    return this.s > thr ? this.at + this.tau * Math.log(this.s / thr) : this.at;
  }
}

/**
 * The fly's pose read from its motor neurons: TTMn → jump, MN9 → proboscis, wing MNs → song.
 * Steps through `log` incrementally; a seek back replays the whole log, so the pose at `t`
 * does not depend on the scrub path.
 */
export class Behavior {
  private readonly n = [0, 0, 0, 0];
  private jump = new Kernel(TAU.jump);
  private proboscis = new Kernel(TAU.proboscis);
  private wing = new Kernel(TAU.wing);
  private lastWing = Number.NEGATIVE_INFINITY;
  private jumpAt: number | null = null;
  /** Events up to here are in; −∞ = nothing yet (the log holds only what is replayable). */
  private t = Number.NEGATIVE_INFINITY;

  constructor(private readonly mask: Uint8Array) {
    for (const e of mask) this.n[e] = (this.n[e] as number) + 1;
  }

  /** True if any row moves the body (otherwise the fly never moves). */
  get any(): boolean {
    return (
      (this.n[EFFECTOR.jump] ?? 0) + (this.n[EFFECTOR.proboscis] ?? 0) + (this.n[EFFECTOR.wing] ?? 0) > 0
    );
  }

  update(log: SpikeLog, t: number): FlyPose {
    if (t < this.t) this.reset();
    const [i0, i1] = log.span(this.t, t);
    const times = log.times;
    const rows = log.rows;
    for (let i = i0; i < i1; i++) {
      const e = this.mask[rows[i] as number];
      if (!e) continue;
      const ti = times[i] as number;
      if (e === EFFECTOR.jump) {
        this.rearm(ti);
        this.jump.add(ti);
        if (this.jumpAt === null && this.jump.hz(ti, this.n[e] ?? 0) >= JUMP_HZ) this.jumpAt = ti;
      } else if (e === EFFECTOR.proboscis) this.proboscis.add(ti);
      else {
        this.wing.add(ti);
        this.lastWing = ti;
      }
    }
    this.rearm(t);
    this.t = t;

    const lift = this.jumpAt === null ? 0 : Math.min(1, (t - this.jumpAt) / JUMP_MS);
    return {
      jumpAt: this.jumpAt,
      lift,
      proboscis: Math.min(1, this.proboscis.hz(t, this.n[EFFECTOR.proboscis] ?? 0) / PROBOSCIS_HZ),
      wing: Math.min(1, this.wing.hz(t, this.n[EFFECTOR.wing] ?? 0) / WING_HZ),
      flick: Math.exp(-(t - this.lastWing) / FLICK_MS),
    };
  }

  /** Landed out of frame and the TTMn have been quiet long enough → standing again. */
  private rearm(t: number) {
    if (this.jumpAt === null || t < this.jumpAt + JUMP_MS) return;
    const quiet = this.jump.below(REARM_HZ, this.n[EFFECTOR.jump] ?? 0);
    if (t - Math.max(quiet, this.jumpAt + JUMP_MS) >= REARM_MS) this.jumpAt = null;
  }

  private reset() {
    this.jump = new Kernel(TAU.jump);
    this.proboscis = new Kernel(TAU.proboscis);
    this.wing = new Kernel(TAU.wing);
    this.lastWing = Number.NEGATIVE_INFINITY;
    this.jumpAt = null;
    this.t = Number.NEGATIVE_INFINITY;
  }
}
