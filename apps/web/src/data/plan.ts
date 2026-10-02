import type { ChunkEntry, Manifest } from '@fly/data';

export interface LoadPlan {
  scenario: string;
  chunks: ChunkEntry[];
  warning?: string;
}

/**
 * Chunks to fetch before the first frame: every first-frame chunk plus the chosen scenario's own
 * chunks (lazy for non-default scenarios). Unknown scenario → the default (first) one + a warning.
 */
export function firstFrameChunks(m: Manifest, scenario: string | undefined): LoadPlan {
  const fallback = m.scenarios[0];
  if (!fallback) throw new Error('manifest has no scenarios');
  const chosen = m.scenarios.find((s) => s.id === scenario);
  const plan: LoadPlan = { scenario: (chosen ?? fallback).id, chunks: [] };
  if (scenario !== undefined && !chosen)
    plan.warning = `scenario: unknown "${scenario}", using ${fallback.id}`;

  const own = new Set((chosen ?? fallback).chunks);
  plan.chunks = m.chunks.filter((c) => c.tier === 'first-frame');
  for (const c of m.chunks) if (c.tier === 'lazy' && own.has(c.id)) plan.chunks.push(c);
  return plan;
}
