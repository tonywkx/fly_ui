import type { ChunkEntry, Manifest } from '@fly/data';

export interface LoadPlan {
  scenario: string;
  chunks: ChunkEntry[];
  warning?: string;
}

/**
 * Chunks to fetch before the first frame: shared first-frame chunks plus the chosen scenario's own
 * (lazy for non-default scenarios); other scenarios' chunks stay unfetched (≤15 MB budget).
 * Unknown scenario → the default (first) one + a warning.
 */
export function firstFrameChunks(m: Manifest, scenario: string | undefined): LoadPlan {
  const fallback = m.scenarios[0];
  if (!fallback) throw new Error('manifest has no scenarios');
  const chosen = m.scenarios.find((s) => s.id === scenario);
  const plan: LoadPlan = { scenario: (chosen ?? fallback).id, chunks: [] };
  if (scenario !== undefined && !chosen)
    plan.warning = `scenario: unknown "${scenario}", using ${fallback.id}`;

  const own = new Set((chosen ?? fallback).chunks);
  const theirs = new Set(m.scenarios.flatMap((s) => s.chunks).filter((id) => !own.has(id)));
  plan.chunks = m.chunks.filter((c) => c.tier === 'first-frame' && !theirs.has(c.id));
  for (const c of m.chunks) if (c.tier === 'lazy' && own.has(c.id)) plan.chunks.push(c);
  return plan;
}
