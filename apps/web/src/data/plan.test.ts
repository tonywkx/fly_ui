import type { Manifest } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { firstFrameChunks } from './plan';

const chunk = (id: string, tier: 'first-frame' | 'lazy', scenario?: string) => ({
  id,
  kind: 'cloud' as const,
  file: `${id}.bin`,
  bytes: 10,
  tier,
  ...(scenario && { scenario }),
});

const manifest = {
  chunks: [
    chunk('shells', 'first-frame'),
    chunk('cloud-lod1', 'lazy'),
    chunk('escape-skeletons', 'first-frame', 'escape'),
    chunk('escape-graph', 'first-frame', 'escape'),
    chunk('sugar-graph', 'first-frame', 'sugar'),
    chunk('sugar-skeletons', 'lazy', 'sugar'),
  ],
  scenarios: [
    { id: 'escape', title: 'Escape', chunks: ['escape-skeletons', 'escape-graph'] },
    { id: 'sugar', title: 'Sugar', chunks: ['sugar-skeletons', 'sugar-graph'] },
  ],
} as unknown as Manifest;

const ids = (r: ReturnType<typeof firstFrameChunks>) => r.chunks.map((c) => c.id);

describe('firstFrameChunks', () => {
  it('defaults to the first scenario: shared + its own first-frame chunks', () => {
    const r = firstFrameChunks(manifest, undefined);
    expect(r.scenario).toBe('escape');
    expect(r.warning).toBeUndefined();
    expect(ids(r)).toEqual(['shells', 'escape-skeletons', 'escape-graph']);
  });

  it('pulls the chosen scenario chunks forward even when lazy', () => {
    const r = firstFrameChunks(manifest, 'sugar');
    expect(r.scenario).toBe('sugar');
    expect(ids(r)).toEqual(['shells', 'sugar-graph', 'sugar-skeletons']);
  });

  it('falls back to the default on an unknown scenario', () => {
    const r = firstFrameChunks(manifest, 'nope');
    expect(r.scenario).toBe('escape');
    expect(r.warning).toMatch(/nope/);
  });
});
