import { PATHS, type PathHop, PUPPET, type PuppetKey } from '@fly/sim';
import type { Pull } from '@/scene/dish/loop';

export const PULL_GLYPH: Record<Pull, string> = { up: '↑', down: '↓', left: '←', right: '→' };

/** A puppet key's decision path from the driven cell on (e.g. ↑: DNp01 → TTMn). */
export function puppetHops(k: PuppetKey): readonly PathHop[] {
  const { decision, types } = PUPPET[k];
  const hops = PATHS[decision].hops;
  return hops.slice(
    Math.max(
      0,
      hops.findIndex((h) => types.test(h.type)),
    ),
  );
}
