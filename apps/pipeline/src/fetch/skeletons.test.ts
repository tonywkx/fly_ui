import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchSkeletons, pickRandom, scoutBodyIds } from './skeletons';

const SWC = '1 1 0 0 0 10 -1\n2 0 1 0 0 2 1\n';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'skel-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const clientWith = (impl: (id: number) => Promise<string | null>) => ({ skeleton: vi.fn(impl) });

describe('pickRandom', () => {
  const ids = Array.from({ length: 100 }, (_, i) => i * 7);

  test('n unique ids from the input, sorted', () => {
    const got = pickRandom(ids, 10, 1);
    expect(got).toHaveLength(10);
    expect(new Set(got).size).toBe(10);
    for (const id of got) expect(ids).toContain(id);
    expect(got).toEqual([...got].sort((a, b) => a - b));
  });

  test('deterministic for a seed, independent of input order', () => {
    expect(pickRandom([...ids].reverse(), 10, 1)).toEqual(pickRandom(ids, 10, 1));
    expect(pickRandom(ids, 10, 2)).not.toEqual(pickRandom(ids, 10, 1));
  });

  test('n beyond the population returns everything', () => {
    expect(pickRandom([3, 1, 2], 10, 1)).toEqual([1, 2, 3]);
  });
});

describe('scoutBodyIds', () => {
  test('collects unique sorted bodyIds across types and scenarios', () => {
    const a = { types: [{ bodyIds: [30, 10] }, { bodyIds: [20, 10] }] };
    const b = { types: [{ bodyIds: [5, 30] }] };
    expect(scoutBodyIds([a, b])).toEqual([5, 10, 20, 30]);
  });

  test('rejects scout files without bodyIds', () => {
    expect(() => scoutBodyIds([{ types: [{ type: 'X' }] }])).toThrow();
  });
});

describe('fetchSkeletons', () => {
  test('downloads, validates and caches each body as <id>.swc', async () => {
    const client = clientWith(async () => SWC);
    const res = await fetchSkeletons({ client, ids: [1, 2], dir });
    expect(res).toEqual({ cached: 0, fetched: 2, missing: [], failed: [] });
    expect(await readFile(join(dir, '1.swc'), 'utf8')).toBe(SWC);
    expect((await readdir(dir)).sort()).toEqual(['1.swc', '2.swc']);
  });

  test('skips cached bodies without a request', async () => {
    await writeFile(join(dir, '1.swc'), SWC);
    const client = clientWith(async () => SWC);
    const res = await fetchSkeletons({ client, ids: [1, 2], dir });
    expect(res).toMatchObject({ cached: 1, fetched: 1 });
    expect(client.skeleton).toHaveBeenCalledTimes(1);
    expect(client.skeleton).toHaveBeenCalledWith(2);
  });

  test('marks bodies without a skeleton and never asks again', async () => {
    const client = clientWith(async () => null);
    expect(await fetchSkeletons({ client, ids: [7], dir })).toMatchObject({ fetched: 0, missing: [7] });
    expect(await readdir(dir)).toEqual(['7.missing']);

    const again = await fetchSkeletons({ client, ids: [7], dir });
    expect(again).toMatchObject({ cached: 0, missing: [7] });
    expect(client.skeleton).toHaveBeenCalledTimes(1);
  });

  test('a failure does not abort the rest and leaves no file', async () => {
    const client = clientWith(async (id) => {
      if (id === 2) throw new Error('network down');
      return SWC;
    });
    const res = await fetchSkeletons({ client, ids: [1, 2, 3], dir });
    expect(res.fetched).toBe(2);
    expect(res.failed).toEqual([{ bodyId: 2, error: 'Error: network down' }]);
    expect((await readdir(dir)).sort()).toEqual(['1.swc', '3.swc']);
  });

  test('invalid swc counts as failed and is not cached', async () => {
    const client = clientWith(async () => 'garbage\n');
    const res = await fetchSkeletons({ client, ids: [4], dir });
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0]?.error).toMatch(/SwcError/);
    expect(await readdir(dir)).toEqual([]);
  });

  test('dedupes ids and reports progress', async () => {
    const client = clientWith(async () => SWC);
    const onProgress = vi.fn();
    await fetchSkeletons({ client, ids: [1, 1, 2], dir, onProgress });
    expect(client.skeleton).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });
});
