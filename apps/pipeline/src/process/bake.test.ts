import { FORMAT_VERSION } from '@fly/data';
import { describe, expect, test } from 'vitest';
import { BudgetError, buildManifest, checkBudget, type ManifestInput } from './bake';

const input = (): ManifestInput => ({
  dataset: 'male-cns:v1.0',
  attribution: 'Janelia FlyEM MaleCNS v1.0, CC-BY 4.0',
  unitNm: 8,
  bbox: { min: [0, 0, 0], max: [10, 20, 30] },
  builtAt: new Date('2026-10-02T12:00:00Z'),
  chunks: [
    { id: 'shells', kind: 'neuropil', tier: 'first-frame', data: new Uint8Array(100) },
    { id: 'cloud-lod1', kind: 'cloud', tier: 'lazy', lod: 1, data: new Uint8Array(1000) },
    { id: 'escape-graph', kind: 'graph', tier: 'first-frame', scenario: 'escape', data: new Uint8Array(30) },
    { id: 'escape-skeletons', kind: 'skeletons', tier: 'lazy', scenario: 'escape', data: new Uint8Array(7) },
  ],
  scenarios: [
    { id: 'escape', title: 'Escape' },
    { id: 'song', title: 'Song' },
  ],
});

describe('buildManifest', () => {
  test('files, sizes and scenario chunk lists', () => {
    const m = buildManifest(input());
    expect(m.formatVersion).toBe(FORMAT_VERSION);
    expect(m.builtAt).toBe('2026-10-02T12:00:00.000Z');
    expect(m.chunks.map((c) => [c.file, c.bytes])).toEqual([
      ['shells.bin', 100],
      ['cloud-lod1.bin', 1000],
      ['escape-graph.bin', 30],
      ['escape-skeletons.bin', 7],
    ]);
    expect(m.chunks[1]?.lod).toBe(1);
    expect(m.scenarios).toEqual([
      { id: 'escape', title: 'Escape', chunks: ['escape-graph', 'escape-skeletons'] },
      { id: 'song', title: 'Song', chunks: [] },
    ]);
  });

  test('rejects an invalid manifest', () => {
    expect(() => buildManifest({ ...input(), unitNm: 0 })).toThrow();
  });
});

describe('checkBudget', () => {
  const m = buildManifest(input());
  test('returns first-frame bytes within budget', () => {
    expect(checkBudget(m, 130)).toBe(130);
  });
  test('throws BudgetError over budget', () => {
    expect(() => checkBudget(m, 129)).toThrow(BudgetError);
  });
});
