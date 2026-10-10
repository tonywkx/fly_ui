import { ARENA_R, type World } from './world';

// Scripted stimulus delivery for an experiment run (docs/EXPERIMENT-SHAPE.md §Run): no aiming,
// geometry relative to the fly's pose when the script starts. Shared by the norm table
// (apps/pipeline explore/norm.ts) and the experiment card, so both see the same take.

export const STIMULI = ['sugar', 'bitter', 'banana', 'female', 'shadow', 'swatter', 'none'] as const;
export type Stimulus = (typeof STIMULI)[number];

/** Sugar / bitter dropped this far ahead of the body centre, mm. */
const DROP = 2.5;
/** Female placed this far ahead, mm. */
const FEMALE_AT = 4;
/** Banana this far in from the rim, straight ahead. */
const RIM_IN = 1.5;
/** Shadow centre slides in from the fly's left: from → to (mm from the start pose) over `SWEEP_MS`. */
const SWEEP_FROM = 9;
const SWEEP_TO = 3;
const SWEEP_MS = 300;

/**
 * The script for one stimulus: call the returned tick before each `world.step`, starting right
 * after `world.reset()`. The first tick places the item or starts the hand.
 */
export function delivery(stim: Stimulus): (w: World) => void {
  let start: { x: number; y: number; c: number; s: number; t: number } | null = null;
  return (w) => {
    const first = !start;
    if (!start) {
      const f = w.fly;
      start = { x: f.x, y: f.y, c: Math.cos(f.heading), s: Math.sin(f.heading), t: w.t };
    }
    const o = start;
    /** A point `fwd` ahead and `left` to the left of the start pose. */
    const at = (fwd: number, left = 0): [number, number] => [
      o.x + fwd * o.c - left * o.s,
      o.y + fwd * o.s + left * o.c,
    ];
    if (first) {
      if (stim === 'sugar' || stim === 'bitter') w.add(stim, ...at(DROP));
      else if (stim === 'female') w.add('female', ...at(FEMALE_AT));
      else if (stim === 'banana') w.add('odor', ...rim(o.x, o.y, o.c, o.s));
      else if (stim === 'swatter') w.swat(o.x, o.y);
    }
    if (stim === 'shadow') {
      const k = Math.min(1, (w.t - o.t) / SWEEP_MS);
      w.shadow(...at(0, SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * k));
    }
  };
}

/** Where the ray from (x, y) along (c, s) meets the circle `ARENA_R − RIM_IN`. */
function rim(x: number, y: number, c: number, s: number): [number, number] {
  const r = ARENA_R - RIM_IN;
  const b = x * c + y * s;
  const d = b * b - (x * x + y * y - r * r);
  const k = -b + Math.sqrt(Math.max(0, d));
  return [x + k * c, y + k * s];
}
