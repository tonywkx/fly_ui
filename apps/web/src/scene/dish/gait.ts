// Tripod gait for the glass fly: L1 R2 L3 swing while R1 L2 R3 push, then swap. Legs are in
// `FlyModel` order (front, mid, hind; right then left each). Body units, x forward.

export const LEG_COUNT = 6;
/** Body travel per full cycle; each foot steps once per cycle (duty factor ½). */
export const STRIDE = 0.8;
const LIFT = 0.12;
/** Tripod of each leg: 0 = R1 L2 R3, 1 = L1 R2 L3. */
export const TRIPOD = [0, 1, 1, 0, 0, 1] as const;

export interface Foot {
  /** Foot shift along x from its rest spot. */
  dx: number;
  /** Height above the floor (0 = planted). */
  lift: number;
}

/** Feet at gait `phase` (cycles; walked distance / `STRIDE`, negative walking backwards). */
export function feet(phase: number): Foot[] {
  const half = STRIDE / 2;
  return TRIPOD.map((k) => {
    const q = (((phase + k / 2) % 1) + 1) % 1;
    // stance: front → back as the body passes over; swing: back → front in the air
    if (q < 0.5) return { dx: half / 2 - (q / 0.5) * half, lift: 0 };
    const u = (q - 0.5) / 0.5;
    return { dx: -half / 2 + u * half, lift: LIFT * Math.sin(Math.PI * u) };
  });
}
