import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bboxOf, type Mesh } from '@fly/data';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { roiFile } from '../fetch/rois';
import { buildNeuropils, decimate, weld } from './neuropil';

/** UV sphere of radius r; every triangle has its own 3 vertices (unwelded, like a soup). */
function sphereSoup(r: number, rings: number, segs: number): Mesh {
  const at = (i: number, j: number) => {
    const th = (Math.PI * i) / rings;
    const ph = (2 * Math.PI * j) / segs;
    return [r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)];
  };
  const pos: number[] = [];
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segs; j++) {
      const [a, b, c, d] = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      if (i > 0) pos.push(...(a as number[]), ...(b as number[]), ...(d as number[]));
      if (i < rings - 1) pos.push(...(b as number[]), ...(c as number[]), ...(d as number[]));
    }
  return {
    pos: Float32Array.from(pos),
    index: Uint32Array.from(pos.map((_, k) => k).slice(0, pos.length / 3)),
  };
}

const toObj = (m: Mesh) => {
  const v = Array.from(
    { length: m.pos.length / 3 },
    (_, i) => `v ${m.pos[i * 3]} ${m.pos[i * 3 + 1]} ${m.pos[i * 3 + 2]}`,
  );
  const f = Array.from(
    { length: m.index.length / 3 },
    (_, t) =>
      `f ${(m.index[t * 3] as number) + 1} ${(m.index[t * 3 + 1] as number) + 1} ${(m.index[t * 3 + 2] as number) + 1}`,
  );
  return [...v, ...f].join('\n');
};

describe('weld', () => {
  test('merges identical positions; every triangle keeps its corners', () => {
    const soup = sphereSoup(100, 16, 32);
    const w = weld(soup);
    const key = (p: Float32Array, i: number) => `${p[i * 3]},${p[i * 3 + 1]},${p[i * 3 + 2]}`;
    const keys = Array.from({ length: w.pos.length / 3 }, (_, i) => key(w.pos, i));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeLessThan(soup.pos.length / 3 / 4);
    expect(w.index.length).toBe(soup.index.length);
    for (let k = 0; k < w.index.length; k++)
      expect(key(w.pos, w.index[k] as number)).toBe(key(soup.pos, soup.index[k] as number));
  });
});

describe('decimate', () => {
  test('reaches the triangle budget, drops unused vertices, keeps the shape', async () => {
    const src = weld(sphereSoup(1000, 64, 128));
    const out = await decimate(src, 500);
    expect(out.index.length / 3).toBeLessThanOrEqual(500);
    expect(out.index.length / 3).toBeGreaterThan(250);
    const used = new Set(out.index);
    expect(used.size).toBe(out.pos.length / 3);
    const a = bboxOf(src.pos, 0);
    const b = bboxOf(out.pos, 0);
    for (let k = 0; k < 3; k++) {
      expect(Math.abs((a.min[k] as number) - (b.min[k] as number))).toBeLessThan(100);
      expect(Math.abs((a.max[k] as number) - (b.max[k] as number))).toBeLessThan(100);
    }
  });

  test('meshes already under budget are returned as is', async () => {
    const src = weld(sphereSoup(10, 4, 8));
    expect(await decimate(src, 10_000)).toEqual(src);
  });
});

describe('buildNeuropils', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'np-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('reads cached rois in the given order, skips uncached ones', async () => {
    await writeFile(join(dir, roiFile("a'L(R)")), toObj(sphereSoup(50, 32, 64)));
    await writeFile(join(dir, roiFile('EB')), toObj(sphereSoup(20, 4, 8)));
    const res = await buildNeuropils({ dir, rois: ['EB', 'nope', "a'L(R)"], targetTris: 300 });
    expect(res.meshes.map((m) => m.name)).toEqual(['EB', "a'L(R)"]);
    expect(res.skipped).toEqual(['nope']);
    for (const m of res.meshes) expect(m.index.length / 3).toBeLessThanOrEqual(300);
  });
});
