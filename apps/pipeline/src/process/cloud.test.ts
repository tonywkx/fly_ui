import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeCloud } from '@fly/data';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { buildCloud } from './cloud';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cloud-'));
  // two straight 100-unit neurons, along x and along y
  await writeFile(join(dir, '1.swc'), '1 1 0 0 0 5 -1\n2 0 100 0 0 1 1\n');
  await writeFile(join(dir, '2.swc'), '1 1 0 0 0 5 -1\n2 0 0 100 0 1 1\n');
  await writeFile(join(dir, '3.swc'), '1 1 0 0 0 5 -1\n2 0 0 0 100 1 1\n');
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('buildCloud', () => {
  test('samples only the requested bodies, skips uncached ones, cuts tiers', async () => {
    const res = await buildCloud({ dir, ids: [1, 2, 99], spacing: 1, tiers: [50, 100], seed: 1, pad: 1 });
    expect(res.bodies).toBe(2);
    expect(res.sampled).toBeGreaterThan(150);
    expect(res.tiers.map((t) => t.length / 3)).toEqual([50, 100]);
    expect(res.bbox.max[2]).toBe(1); // body 3 not requested: no z extent beyond the pad
    const back = decodeCloud(res.chunks[0] as Uint8Array, res.bbox);
    expect(back.length).toBe(150);
  });

  test('deterministic for a seed', async () => {
    const opts = { dir, ids: [1, 2, 3], spacing: 2, tiers: [20], seed: 5 };
    const a = await buildCloud(opts);
    const b = await buildCloud(opts);
    expect(Array.from(a.tiers[0] as Float32Array)).toEqual(Array.from(b.tiers[0] as Float32Array));
  });
});
