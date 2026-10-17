import type { NeuropilRange, NeuropilSet } from '@fly/data';
import type { Site } from '../../state/trial';
import type { Vec3 } from './hologram';

/** A region shell's colour: the preview (bone), switched off (ash), switched on (saffron). */
export type Tint = 'bone' | 'ash' | 'saffron';

/** An op region's look over the base shell (additive): rim / fill gains and its dust's brightness (× rest). */
export interface Look {
  tint: Tint;
  rim: number;
  fill: number;
  dust: number;
}

/** Not lit, not operated: the region adds nothing. */
export const QUIET: Look = { tint: 'bone', rim: 0, fill: 0, dust: 1 };
/** Hovered / focused in the op list (SURGEON-SHAPE §Hologram: bone at ~35 % rim, a soft fill). */
const LIT = { tint: 'bone', rim: 1, fill: 0.05 } as const;
/** In force: off = an ash rim over dimmed dust, on = a warm saffron glow. */
const OFF = { tint: 'ash', rim: 0.4, fill: 0, dust: 0.25 } as const;
const ON = { tint: 'saffron', rim: 1, fill: 0.06, dust: 1 } as const;
/** Where a choice starts before it settles into its mark (the 400 ms pulse). */
export const PULSE: Look = { tint: 'bone', rim: 1.6, fill: 0.1, dust: 1 };

/**
 * A new op in force is a choice to pulse; `was` undefined = the hologram's first show, where the op
 * was already there (remembered from the journal, kept on the way back from the brain).
 */
export function chosen(was: Site | null | undefined, now: Site | null): boolean {
  return was !== undefined && !!now && (now.region !== was?.region || now.mode !== was?.mode);
}

/** The hologram's size while the op list is open (× rest). */
const GROW = { desk: 1.8, phone: 1.5 };

/** What `region` shows for the hovered row (`lit`) and the op in force (`operated`). */
export function regionLook(region: string, lit: Site | 'all' | null, operated: Site | null): Look {
  const op = operated?.region === region ? (operated.mode === 'off' ? OFF : ON) : null;
  if (lit !== 'all' && lit?.region === region) return { ...LIT, dust: op?.dust ?? 1 };
  return op ? { ...op } : QUIET;
}

/** The base shell's rim (× rest): the brain row lights all of it. */
export function wholeRim(lit: Site | 'all' | null): number {
  return lit === 'all' ? 2.5 : 1;
}

/** `cur` eased towards `target` over `dt` ms with time constant `ms` (0 = at once); interruptible. */
export function approach(cur: number, target: number, dt: number, ms: number): number {
  if (ms <= 0) return target;
  return cur + (target - cur) * (1 - Math.exp(-dt / ms));
}

/** The hologram's scale for the op list's state. */
export function grown(listing: boolean, phone: boolean): number {
  return listing ? (phone ? GROW.phone : GROW.desk) : 1;
}

/** An op region's mesh: its left half (as `site` without a side), else the unpaired one. */
export function rangeOf(set: NeuropilSet, region: string): NeuropilRange | null {
  return (
    set.ranges.find((r) => r.name === `${region}(L)`) ?? set.ranges.find((r) => r.name === region) ?? null
  );
}

/** A mesh's vertex box (source units). */
export function boxOf(set: NeuropilSet, r: NeuropilRange): { min: Vec3; max: Vec3 } {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let v = r.vertStart; v < r.vertStart + r.vertCount; v++)
    for (let k = 0; k < 3; k++) {
      const x = set.pos[v * 3 + k] as number;
      min[k] = Math.min(min[k] as number, x);
      max[k] = Math.max(max[k] as number, x);
    }
  return { min: min as Vec3, max: max as Vec3 };
}

/** Each dot's box (1-based, first that holds it; 0 = none): a cheap point-in-region test (§Open 3). */
export function tagDots(
  dots: Float32Array,
  boxes: readonly { readonly min: readonly number[]; readonly max: readonly number[] }[],
): Uint8Array {
  const n = dots.length / 3;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++)
    out[i] =
      boxes.findIndex((b) => {
        for (let k = 0; k < 3; k++) {
          const x = dots[i * 3 + k] as number;
          if (x < (b.min[k] as number) || x > (b.max[k] as number)) return false;
        }
        return true;
      }) + 1;
  return out;
}
