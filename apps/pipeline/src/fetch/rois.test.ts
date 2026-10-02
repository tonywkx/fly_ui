import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fetchRoiMeshes, primaryRois, roiFile } from './rois';

const OBJ = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'roi-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const clientWith = (impl: (roi: string) => Promise<string | null>) => ({ roiMesh: vi.fn(impl) });

describe('primaryRois', () => {
  test('primary rois from :Meta without the *-unspecified leftovers', async () => {
    const rows = [
      { rois: ['AB(L)', 'CentralBrain-unspecified', 'GNG', 'Optic-unspecified(L)', 'VNC-unspecified'] },
    ];
    const client = { query: async <T>() => rows as T[] };
    await expect(primaryRois(client)).resolves.toEqual(['AB(L)', 'GNG']);
  });
});

describe('fetchRoiMeshes', () => {
  test('downloads, validates and caches each roi under an encoded file name', async () => {
    const client = clientWith(async () => OBJ);
    const res = await fetchRoiMeshes({ client, rois: ['AB(L)', "a'L(R)"], dir });
    expect(res).toEqual({ cached: 0, fetched: 2, missing: [], failed: [] });
    expect(await readFile(join(dir, roiFile("a'L(R)")), 'utf8')).toBe(OBJ);
    expect((await readdir(dir)).sort()).toEqual([roiFile('AB(L)'), roiFile("a'L(R)")].sort());
  });

  test('skips cached and known-missing rois; marks new missing ones', async () => {
    await writeFile(join(dir, roiFile('A')), OBJ);
    await writeFile(join(dir, roiFile('B').replace(/\.obj$/, '.missing')), '');
    const client = clientWith(async (roi) => (roi === 'C' ? null : OBJ));
    const res = await fetchRoiMeshes({ client, rois: ['A', 'B', 'C', 'D'], dir });
    expect(res).toEqual({ cached: 1, fetched: 1, missing: ['B', 'C'], failed: [] });
    expect(client.roiMesh.mock.calls.map((c) => c[0]).sort()).toEqual(['C', 'D']);
  });

  test('invalid obj and errors are reported, not cached', async () => {
    const client = clientWith(async (roi) => {
      if (roi === 'bad') return 'v 0 0 0\nf 1 2 3\n';
      throw new Error('boom');
    });
    const res = await fetchRoiMeshes({ client, rois: ['bad', 'err'], dir });
    expect(res.failed.map((f) => f.roi)).toEqual(['bad', 'err']);
    expect(await readdir(dir)).toEqual([]);
  });
});
