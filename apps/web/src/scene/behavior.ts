import { NONE16 } from '@fly/data';
import type { SpikeLog } from '@/sim/feed';

/** Which body part a motor neuron moves. */
export const EFFECTOR = { none: 0, jump: 1, proboscis: 2, wing: 3 } as const;
export type Effector = (typeof EFFECTOR)[keyof typeof EFFECTOR];

/** Tergotrochanteral MN: the jump muscle (escape). */
export const JUMP = /^TTMn$/;
/** Proboscis extension (sugar, Shiu 2024). */
export const PROBOSCIS = /^MN9$/;
/** Direct wing steering MNs that pIP10 drives during song (hg1–4, ps1, b1–3, i1–2, iii1–3, tp1–2). */
export const WING = /^(hg\d|ps\d|b\d|i\d|iii\d|tp\d) MN$/;

/** Kernel time constants (sim ms) of the per-effector rate estimates. */
const TAU = { jump: 20, proboscis: 40, wing: 50 };
/**
 * Mean TTMn rate (Hz, kernel estimate) that launches a jump; one lone spike reads 50. Escape: crossed
 * at ≈30 ms (peak ≈290); Giant Fiber silenced: a brief TTMn burst peaks at ≈176 (live) → no jump.
 */
const JUMP_HZ = 200;
/**
 * Out of frame this long (sim ms) → a new fly is set down, whatever the TTMn do: under steady
 * drive it takes off again (repeat escapes), never an empty frame.
 */
const AWAY_MS = 60;
/** The new fly drops in from above over this long, sim ms. */
const LAND_MS = 30;
/** …and stands at least this long (sim ms) before it can take off again: the frame is mostly fly. */
const HOLD_MS = 120;
/** Takeoff to out of frame, sim ms (the camera is high-speed: sim time, not wall time). */
const JUMP_MS = 60;
/** Rate (Hz) of full extension. */
const PROBOSCIS_HZ = 80;
const WING_HZ = 8;
/** Decay of one wing flick (a spike), sim ms. */
const FLICK_MS = 3;

/** Above this a part (proboscis, wing) counts as moving. */
export const SHOWN = 0.2;

export interface FlyPose {
  /** Sim time of the current takeoff, null while standing. */
  jumpAt: number | null;
  /** Sim time of the first takeoff of the run (the escape latency), null before it. */
  firstJumpAt: number | null;
  /** Takeoffs so far in the run. */
  jumps: number;
  /** 0 standing … 1 out of frame. */
  lift: number;
  /** 1 a new fly just set down above its spot … 0 landed. */
  drop: number;
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
  private firstJumpAt: number | null = null;
  private jumps = 0;
  /** When the last new fly was set down. */
  private backAt = Number.NEGATIVE_INFINITY;
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
        const ready = this.jumpAt === null && ti >= this.backAt + LAND_MS + HOLD_MS;
        if (ready && this.jump.hz(ti, this.n[e] ?? 0) >= JUMP_HZ) this.takeoff(ti);
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
      firstJumpAt: this.firstJumpAt,
      jumps: this.jumps,
      lift,
      drop: Math.max(0, 1 - (t - this.backAt) / LAND_MS),
      proboscis: Math.min(1, this.proboscis.hz(t, this.n[EFFECTOR.proboscis] ?? 0) / PROBOSCIS_HZ),
      wing: Math.min(1, this.wing.hz(t, this.n[EFFECTOR.wing] ?? 0) / WING_HZ),
      flick: Math.exp(-(t - this.lastWing) / FLICK_MS),
    };
  }

  private takeoff(t: number) {
    this.jumpAt = t;
    this.firstJumpAt ??= t;
    this.jumps++;
  }

  /** Out of frame long enough → a new fly is standing there. */
  private rearm(t: number) {
    if (this.jumpAt === null) return;
    const back = this.jumpAt + JUMP_MS + AWAY_MS;
    if (t < back) return;
    this.jumpAt = null;
    this.backAt = back;
  }

  private reset() {
    this.jump = new Kernel(TAU.jump);
    this.proboscis = new Kernel(TAU.proboscis);
    this.wing = new Kernel(TAU.wing);
    this.lastWing = Number.NEGATIVE_INFINITY;
    this.jumpAt = null;
    this.firstJumpAt = null;
    this.jumps = 0;
    this.backAt = Number.NEGATIVE_INFINITY;
    this.t = Number.NEGATIVE_INFINITY;
  }
}
