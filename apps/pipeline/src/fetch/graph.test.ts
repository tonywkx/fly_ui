import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchBatches, fetchEdgeBatch, fetchNeuronBatch, loadBatches, regionOf } from './graph';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'graph-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const primary = new Set(['GNG', 'SMP(L)', 'AL(R)']);

describe('regionOf', () => {
  test('argmax of pre+post over primary rois only', () => {
    const info = JSON.stringify({
      CentralBrain: { pre: 900, post: 900 },
      GNG: { pre: 10, post: 5 },
      'SMP(L)': { post: 20 },
      'AL(R)': { pre: 1 },
    });
    expect(regionOf(info, primary)).toBe('SMP(L)');
    expect(regionOf(JSON.stringify({ VNC: { pre: 3 } }), primary)).toBeNull();
    expect(regionOf(null, primary)).toBeNull();
  });
});

describe('batch queries', () => {
  test('neuron batch resolves region and drops roiInfo', async () => {
    const query = vi.fn(async (_cypher: string) => [
      {
        bodyId: 1,
        type: 'DNp01',
        class: null,
        superclass: 'descending_neuron',
        nt: 'acetylcholine',
        ntConf: 0.5,
        somaSide: 'R',
        fruDsx: null,
        roiInfo: JSON.stringify({ GNG: { pre: 3 } }),
      },
    ]);
    const rows = await fetchNeuronBatch({ query } as never, [1], primary);
    expect(rows).toEqual([
      {
        bodyId: 1,
        type: 'DNp01',
        class: null,
        superclass: 'descending_neuron',
        nt: 'acetylcholine',
        ntConf: 0.5,
        somaSide: 'R',
        fruDsx: null,
        region: 'GNG',
      },
    ]);
    expect(query.mock.calls[0]?.[0]).toMatch(/n\.bodyId IN \[1\]/);
  });

  test('edge batch is columnar and filters by weight in cypher', async () => {
    const query = vi.fn(async (_cypher: string) => [
      { a: 1, b: 2, w: 7 },
      { a: 1, b: 3, w: 5 },
    ]);
    await expect(fetchEdgeBatch({ query } as never, [1, 9])).resolves.toEqual({
      pre: [1, 1],
      post: [2, 3],
      w: [7, 5],
    });
    expect(query.mock.calls[0]?.[0]).toMatch(/IN \[1, ?9\] AND c\.weight >= 5/);
  });
});

describe('fetchBatches', () => {
  test('fixed batches, cached on disk, resumable, failures not cached', async () => {
    const ids = [1, 2, 3, 4, 5];
    let fail = true;
    const fetch = vi.fn(async (batch: number[]) => {
      if (batch[0] === 3 && fail) throw new Error('boom');
      return batch;
    });
    const first = await fetchBatches({ ids, size: 2, dir, prefix: 'x', fetch });
    expect(first).toEqual({ cached: 0, fetched: 2, failed: [{ batch: 1, error: 'Error: boom' }] });
    fail = false;
    const second = await fetchBatches({ ids, size: 2, dir, prefix: 'x', fetch });
    expect(second).toEqual({ cached: 2, fetched: 1, failed: [] });
    expect((await readdir(dir)).sort()).toEqual(['x-0.json', 'x-1.json', 'x-2.json']);
    await expect(loadBatches(dir, 'x', 3)).resolves.toEqual([[1, 2], [3, 4], [5]]);
  });
});
