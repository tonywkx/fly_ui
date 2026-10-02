import { describe, expect, test } from 'vitest';
import { chunksFor, firstFrameBytes } from './chunks';
import { FORMAT_VERSION, FormatVersionError, parseManifest } from './manifest';

const fixture = () => ({
  formatVersion: FORMAT_VERSION,
  dataset: 'male-cns:v1.0',
  attribution: 'Janelia FlyEM MaleCNS v1.0, CC-BY 4.0',
  builtAt: '2026-10-01T12:00:00Z',
  unitNm: 8,
  bbox: { min: [0, 0, 0], max: [100_000, 200_000, 300_000] },
  chunks: [
    {
      id: 'escape-skel',
      kind: 'skeletons',
      file: 'escape/skel.bin',
      bytes: 3_000_000,
      tier: 'first-frame',
      scenario: 'escape',
    },
    {
      id: 'escape-graph',
      kind: 'graph',
      file: 'escape/graph.bin',
      bytes: 200_000,
      tier: 'first-frame',
      scenario: 'escape',
    },
    { id: 'cloud-0', kind: 'cloud', file: 'cloud-0.bin', bytes: 1_000_000, tier: 'first-frame', lod: 0 },
    { id: 'cloud-1', kind: 'cloud', file: 'cloud-1.bin', bytes: 4_000_000, tier: 'lazy', lod: 1 },
    { id: 'full-graph', kind: 'graph', file: 'graph.bin', bytes: 15_000_000, tier: 'lazy' },
  ],
  scenarios: [{ id: 'escape', title: 'Escape', chunks: ['escape-skel', 'escape-graph'] }],
});

describe('parseManifest', () => {
  test('accepts a valid manifest', () => {
    const m = parseManifest(fixture());
    expect(m.chunks).toHaveLength(5);
    expect(m.scenarios[0]?.chunks).toEqual(['escape-skel', 'escape-graph']);
  });

  test('rejects another format version with FormatVersionError', () => {
    const bad = { ...fixture(), formatVersion: FORMAT_VERSION + 1 };
    expect(() => parseManifest(bad)).toThrow(FormatVersionError);
  });

  test('rejects missing format version with FormatVersionError', () => {
    expect(() => parseManifest({ chunks: [] })).toThrow(FormatVersionError);
  });

  test('rejects duplicate chunk ids', () => {
    const m = fixture();
    const dup = { ...m, chunks: [...m.chunks, ...m.chunks.slice(0, 1)] };
    expect(() => parseManifest(dup)).toThrow(/duplicate chunk id/);
  });

  test('rejects scenario referencing unknown chunk', () => {
    const m = fixture();
    m.scenarios[0]?.chunks.push('nope');
    expect(() => parseManifest(m)).toThrow(/unknown chunk/);
  });

  test('rejects unknown chunk kind', () => {
    const m = fixture();
    const bad = { ...m, chunks: [...m.chunks, { ...m.chunks[0], id: 'x', kind: 'video' }] };
    expect(() => parseManifest(bad)).toThrow();
  });

  test('rejects missing or non-positive unitNm', () => {
    const { unitNm: _, ...missing } = fixture();
    expect(() => parseManifest(missing)).toThrow();
    expect(() => parseManifest({ ...fixture(), unitNm: 0 })).toThrow();
  });

  test('rejects degenerate bbox', () => {
    const m = fixture();
    m.bbox.max[1] = 0;
    expect(() => parseManifest(m)).toThrow(/bbox/);
  });
});

describe('chunk index', () => {
  const m = parseManifest(fixture());

  test('filters by scenario, tier, kind', () => {
    expect(chunksFor(m, { scenario: 'escape' }).map((c) => c.id)).toEqual(['escape-skel', 'escape-graph']);
    expect(chunksFor(m, { tier: 'lazy' }).map((c) => c.id)).toEqual(['cloud-1', 'full-graph']);
    expect(chunksFor(m, { kind: 'graph', tier: 'first-frame' }).map((c) => c.id)).toEqual(['escape-graph']);
    expect(chunksFor(m)).toHaveLength(5);
  });

  test('firstFrameBytes sums first-frame chunks', () => {
    expect(firstFrameBytes(m)).toBe(4_200_000);
  });
});
