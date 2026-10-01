import type { ChunkEntry, ChunkKind, ChunkTier, Manifest } from './manifest';

export interface ChunkFilter {
  scenario?: string;
  tier?: ChunkTier;
  kind?: ChunkKind;
}

export function chunksFor(m: Manifest, f: ChunkFilter = {}): ChunkEntry[] {
  return m.chunks.filter(
    (c) =>
      (f.scenario === undefined || c.scenario === f.scenario) &&
      (f.tier === undefined || c.tier === f.tier) &&
      (f.kind === undefined || c.kind === f.kind),
  );
}

/** Bytes fetched before the first frame (budget: 15 MB, enforced by bake). */
export function firstFrameBytes(m: Manifest): number {
  return chunksFor(m, { tier: 'first-frame' }).reduce((sum, c) => sum + c.bytes, 0);
}
