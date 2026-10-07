import type { NeuropilSet } from '@fly/data';
import { mulberry32, PATHS } from '@fly/sim';
import { describe, expect, it } from 'vitest';
import { centroids, holoFrame, hopSites, SPREAD, sample, site, type Vec3 } from './hologram';

/** One-vertex "meshes" at the given points. */
function set(named: Record<string, Vec3>): NeuropilSet {
  const names = Object.keys(named);
  return {
    pos: Float32Array.from(names.flatMap((n) => named[n] as Vec3)),
    index: new Uint32Array(0),
    ranges: names.map((name, i) => ({ name, vertStart: i, vertCount: 1, indexStart: 0, indexCount: 0 })),
  };
}

describe('hologram', () => {
  it('samples n points that exist in the source', () => {
    const pos = Float32Array.from({ length: 300 }, (_, i) => Math.floor(i / 3));
    const s = sample(pos, 20, mulberry32(1));
    expect(s).toHaveLength(60);
    for (let k = 0; k < 20; k++) expect(s[k * 3]).toBe(s[k * 3 + 2]);
    expect(sample(pos, 500, mulberry32(1))).toHaveLength(300);
  });

  it('averages each mesh', () => {
    const c = centroids({
      pos: Float32Array.of(0, 0, 0, 2, 4, 6, 10, 10, 10),
      index: new Uint32Array(0),
      ranges: [
        { name: 'A', vertStart: 0, vertCount: 2, indexStart: 0, indexCount: 0 },
        { name: 'B', vertStart: 2, vertCount: 1, indexStart: 0, indexCount: 0 },
      ],
    });
    expect(c.get('A')).toEqual([1, 2, 3]);
    expect(c.get('B')).toEqual([10, 10, 10]);
  });

  it('picks the stimulus side, the unpaired mesh, or both halves', () => {
    const c = centroids(set({ 'LO(L)': [0, 0, 0], 'LO(R)': [10, 0, 0], GNG: [5, 5, 5] }));
    expect(site(c, 'LO', 'R')).toEqual([10, 0, 0]);
    expect(site(c, 'LO', null)).toEqual([0, 0, 0]);
    expect(site(c, 'GNG', 'R')).toEqual([5, 5, 5]);
    expect(site(c, 'XX', 'L')).toBeNull();
  });

  it('fans out hops that share a neuropil', () => {
    const c = centroids(set({ GNG: [0, 0, 0], 'FLA(L)': [1, 1, 1], 'LAL(L)': [9, 9, 9] }));
    const s = hopSites(PATHS.back, 'L', c) as Vec3[];
    expect(s).toHaveLength(PATHS.back.hops.length);
    expect(s[0]).toEqual([0, 0, 0]);
    const gng = s.filter((_, i) => PATHS.back.hops[i]?.region === 'GNG');
    for (let i = 1; i < gng.length; i++)
      expect(Math.hypot(...(gng[i] as Vec3).map((x, a) => x - ((gng[0] as Vec3)[a] as number)))).toBeCloseTo(
        SPREAD,
      );
  });

  it('turns EM space into the fly frame: anterior forward, dorsal up, left to the left', () => {
    const { rows, map } = holoFrame({ min: [0, 0, 0], max: [50, 50, 100] }, 1);
    expect(map([25, 25, 50]).map((x) => x + 0)).toEqual([0, 0, 0]);
    expect(map([25, 25, 0])[0]).toBeCloseTo(1); // anterior → +x
    expect(map([25, 0, 50])[1]).toBeCloseTo(0.5); // dorsal → +y
    expect(map([50, 25, 50])[2]).toBeCloseTo(-0.5); // left → −z (her right is +z)
    const p: Vec3 = [10, 20, 30];
    const m = (i: number) => rows[i] as number;
    const viaRows = [0, 1, 2].map(
      (r) => m(r * 4) * p[0] + m(r * 4 + 1) * p[1] + m(r * 4 + 2) * p[2] + m(r * 4 + 3),
    );
    expect(viaRows[0]).toBeCloseTo(map(p)[0]);
    expect(viaRows[1]).toBeCloseTo(map(p)[1]);
    expect(viaRows[2]).toBeCloseTo(map(p)[2]);
  });
});
