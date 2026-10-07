import { ARENA_R, type Item } from '@fly/sim';

interface V3 {
  x: number;
  y: number;
  z: number;
}
/** A point on the dish floor in world mm (scene x = x, scene −z = y). */
export interface Spot {
  x: number;
  y: number;
}

/** Grab reach around an item's centre, mm. */
const GRAB = 0.9;
/** Where `ahead` drops a thing: distance in front of the fly, clearance from items and the rim, mm. */
const AHEAD = 3;
const CLEAR = 1.4;
const RIM = 1;

/** Where a ray from `o` along `d` meets the floor (scene y = 0); null when it never does. */
export function floorHit(o: V3, d: V3): Spot | null {
  if (d.y >= 0) return null;
  const k = -o.y / d.y;
  return { x: o.x + k * d.x, y: -(o.z + k * d.z) };
}

export const inDish = (p: Spot) => Math.hypot(p.x, p.y) < ARENA_R;

/** The item nearest to `p` within grab reach. */
export function itemAt(items: readonly Item[], x: number, y: number): Item | null {
  let best: Item | null = null;
  let bd = GRAB;
  for (const it of items) {
    const d = Math.hypot(it.x - x, it.y - y);
    if (d < bd) [best, bd] = [it, d];
  }
  return best;
}

/** A free spot in front of the fly (fanning out to the sides), else toward the dish centre. */
export function ahead(fly: { x: number; y: number; heading: number }, items: readonly Item[]): Spot {
  const free = (p: Spot) =>
    Math.hypot(p.x, p.y) < ARENA_R - RIM && items.every((i) => Math.hypot(i.x - p.x, i.y - p.y) > CLEAR);
  for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6]) {
    const a = fly.heading + (k * Math.PI) / 6;
    const p = { x: fly.x + AHEAD * Math.cos(a), y: fly.y + AHEAD * Math.sin(a) };
    if (free(p)) return p;
  }
  const r = Math.hypot(fly.x, fly.y);
  const s = r > AHEAD ? (r - AHEAD) / r : 0;
  return { x: fly.x * s, y: fly.y * s };
}
