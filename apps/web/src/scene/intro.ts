/**
 * Intro choreography (pure): dust assembles into the CNS silhouette while data loads, then the
 * camera dives to the working framing while shells and neurons fade in.
 * Curves are the project's strong ease-out / ease-in-out (animate skill), never hand-rolled.
 */

/** CSS-style `cubic-bezier(x1, y1, x2, y2)` as an easing function on 0..1 (clamped). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  // B(s) = 3(1−s)²s·p1 + 3(1−s)s²·p2 + s³ as a polynomial in s
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (s: number) => ((ax * s + bx) * s + cx) * s;
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;

  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // Newton from s = t, bisection when the slope is too flat or it diverges
    let s = t;
    for (let i = 0; i < 8; i++) {
      const err = x(s) - t;
      if (Math.abs(err) < 1e-7) return ((ay * s + by) * s + cy) * s;
      const d = dx(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0;
    let hi = 1;
    s = t;
    for (let i = 0; i < 40 && hi - lo > 1e-7; i++) {
      if (x(s) < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return ((ay * s + by) * s + cy) * s;
  };
}

/** Strong ease-out for entrances; strong ease-in-out for on-screen movement. */
export const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);

/** `n` samples of `ease` at i/(n−1), for a shader lookup table. */
export function bezierLut(ease: (t: number) => number, n: number): Float32Array {
  return Float32Array.from({ length: n }, (_, i) => ease(i / (n - 1)));
}

export const INTRO = {
  /** Per-particle start delay spread and flight time; assembly ends when the last one lands. */
  delayMs: 1400,
  flightMs: 1600,
  assembleMs: 3000,
  diveMs: 1800,
  /** Shells + neurons fade in over the start of the dive. */
  revealMs: 900,
} as const;

export type IntroPhase = 'assemble' | 'dive' | 'done';

export interface IntroState {
  phase: IntroPhase;
  /** Assembly clock for the dust shader, ms (0..assembleMs). */
  assembleMs: number;
  /** Eased camera progress, far pose → framing. */
  dive: number;
  /** Eased shells/neurons opacity. */
  reveal: number;
}

/**
 * State at `t` ms after the dust arrived; `readyAt` = when the rest of the data was ready (∞ while
 * loading). The dive waits for both the assembly and the data.
 */
export function introTimeline(t: number, readyAt: number): IntroState {
  const diveStart = Math.max(INTRO.assembleMs, readyAt);
  const since = t - diveStart;
  return {
    phase: since < 0 ? 'assemble' : since < INTRO.diveMs ? 'dive' : 'done',
    assembleMs: Math.min(Math.max(t, 0), INTRO.assembleMs),
    dive: EASE_IN_OUT(since / INTRO.diveMs),
    reveal: EASE_OUT(since / INTRO.revealMs),
  };
}

/** Camera on a sphere around the orbit target; azimuth about +y from +z, radians. */
export interface Pose {
  radius: number;
  azimuth: number;
  elevation: number;
}

/** Radius in log space (a dolly reads as constant speed), azimuth the short way round. */
export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const tau = 2 * Math.PI;
  const dAz = ((((b.azimuth - a.azimuth) % tau) + tau + Math.PI) % tau) - Math.PI;
  return {
    radius: a.radius * (b.radius / a.radius) ** k,
    azimuth: a.azimuth + dAz * k,
    elevation: a.elevation + (b.elevation - a.elevation) * k,
  };
}

export function posePosition(p: Pose): [number, number, number] {
  const r = p.radius * Math.cos(p.elevation);
  return [r * Math.sin(p.azimuth), p.radius * Math.sin(p.elevation), r * Math.cos(p.azimuth)];
}
