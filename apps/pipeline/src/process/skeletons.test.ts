import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { buildSkeletons } from './skeletons';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'skel-'));
  // straight line along x with collinear interior nodes, and a short bent neuron
  await writeFile(join(dir, '1.swc'), '1 1 0 0 0 5 -1\n2 0 10 0 0 1 1\n3 0 20 0 0 1 2\n4 0 30 0 0 1 3\n');
  await writeFile(join(dir, '2.swc'), '1 1 0 0 0 5 -1\n2 0 0 10 0 1 1\n3 0 0 10 -7 1 2\n');
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('buildSkeletons', () => {
  test('simplifies cached bodies in id order, reports missing ones', async () => {
    const res = await buildSkeletons({ dir, ids: [2, 99, 1], epsilon: 1 });
    expect(res.items.map((i) => i.bodyId)).toEqual([2, 1]);
    expect(res.missing).toEqual([99]);
    expect(res.nodes).toEqual({ before: 7, after: 5 });
    expect(res.items[1]?.skeleton.parent.length).toBe(2);
    expect(res.bbox).toEqual({ min: [0, 0, -7], max: [30, 10, 0] });
  });

  test('null bbox when nothing is cached', async () => {
    const res = await buildSkeletons({ dir, ids: [5], epsilon: 1 });
    expect(res.items).toEqual([]);
    expect(res.bbox).toBeNull();
  });
});
