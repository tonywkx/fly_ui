import { describe, expect, test } from 'vitest';
import { decodeChunk, encodeChunk } from './container';
import {
  type BBox,
  decodeSkeletons,
  dequantize,
  encodeSkeletons,
  pathDistance,
  quantize,
  simplify,
} from './skeleton';
import { parseSwc, type Skeleton } from './swc';

const swc = (...rows: string[]) => parseSwc(rows.join('\n'));
const parents = (sk: Skeleton) => Array.from(sk.parent);
const xs = (sk: Skeleton) => Array.from(sk.pos.filter((_, i) => i % 3 === 0));

/** Straight chain along x: soma at 0, nodes every 10 units. */
const line = (n: number) =>
  swc(
    '1 1 0 0 0 5 -1',
    ...Array.from({ length: n - 1 }, (_, i) => `${i + 2} 0 ${(i + 1) * 10} 0 0 1 ${i + 1}`),
  );

// Y tree: soma(0,0,0) - (10,0,0) branch; left arm to (10,10,0), right arm to (10,-10,0)->(20,-10,0)
const ytree = () =>
  swc(
    '1 1 0 0 0 5 -1',
    '2 0 10 0 0 2 1',
    '3 0 10 5 0 1 2',
    '4 0 10 10 0 1 3',
    '5 0 10 -10 0 1 2',
    '6 0 20 -10 0 1 5',
  );

describe('simplify', () => {
  test('collinear chain collapses to its endpoints', () => {
    const sk = simplify(line(10), 0.5);
    expect(xs(sk)).toEqual([0, 90]);
    expect(parents(sk)).toEqual([-1, 0]);
    expect(Array.from(sk.radius)).toEqual([5, 1]);
    expect(sk.soma).toBe(0);
  });

  test('keeps a bend larger than epsilon, drops one smaller', () => {
    const bent = swc('1 1 0 0 0 5 -1', '2 0 10 3 0 1 1', '3 0 20 0 0 1 2');
    expect(xs(simplify(bent, 1))).toEqual([0, 10, 20]);
    expect(xs(simplify(bent, 5))).toEqual([0, 20]);
  });

  test('RDP recurses: keeps the farthest point then splits', () => {
    // zigzag: only node at x=20 (y=8) and x=40 (y=-8) exceed eps against their sub-chords
    const z = swc(
      '1 1 0 0 0 5 -1',
      '2 0 10 4 0 1 1',
      '3 0 20 8 0 1 2',
      '4 0 30 0 0 1 3',
      '5 0 40 -8 0 1 4',
      '6 0 50 0 0 1 5',
    );
    const sk = simplify(z, 2);
    expect(xs(sk)).toEqual([0, 20, 40, 50]);
    expect(parents(sk)).toEqual([-1, 0, 1, 2]);
  });

  test('soma, branch points and leaves always survive', () => {
    const sk = simplify(ytree(), 100);
    // node (10,5,0) is interior on a straight arm -> dropped; (10,-10,0) is a bend but eps is huge -> dropped
    expect(xs(sk)).toEqual([0, 10, 10, 20]);
    expect(parents(sk)).toEqual([-1, 0, 1, 1]);
  });

  test('epsilon 0 keeps every non-collinear node', () => {
    const sk = simplify(ytree(), 0);
    expect(xs(sk)).toEqual([0, 10, 10, 10, 20]);
    expect(parents(sk)).toEqual([-1, 0, 1, 1, 2]);
  });

  test('fragments are simplified independently, parent[i] < i holds', () => {
    const sk = simplify(
      swc(
        '1 1 0 0 0 5 -1',
        '2 0 10 0 0 1 1',
        '3 0 20 0 0 1 2',
        '10 0 100 0 0 1 -1',
        '11 0 100 10 0 1 10',
        '12 0 100 20 0 1 11',
      ),
      0.5,
    );
    expect(parents(sk)).toEqual([-1, 0, -1, 2]);
    expect(xs(sk)).toEqual([0, 20, 100, 100]);
    sk.parent.forEach((p, i) => {
      expect(p).toBeLessThan(i);
    });
  });
});

describe('pathDistance', () => {
  test('cumulative euclidean length from the soma', () => {
    const d = Array.from(pathDistance(ytree()));
    // BFS order: soma, (10,0), (10,5), (10,-10), (10,10), (20,-10)
    expect(d).toEqual([0, 10, 15, 20, 20, 30]);
  });

  test('extra fragments start at 0', () => {
    const d = Array.from(
      pathDistance(swc('1 1 0 0 0 5 -1', '2 0 3 4 0 1 1', '5 0 50 0 0 1 -1', '6 0 50 0 7 1 5')),
    );
    expect(d).toEqual([0, 5, 0, 7]);
  });
});

const box: BBox = { min: [0, -100, 1000], max: [65535, 100, 2000] };

describe('quantize', () => {
  test('bbox corners map to 0 and 65535', () => {
    const q = quantize(new Float32Array([0, -100, 1000, 65535, 100, 2000]), box);
    expect(Array.from(q)).toEqual([0, 0, 0, 65535, 65535, 65535]);
  });

  test('roundtrip error is at most half a step per axis', () => {
    const pos = new Float32Array([123.4, 3.3, 1500.5, 40000.7, -99.9, 1999.99]);
    const back = dequantize(quantize(pos, box), box);
    pos.forEach((v, i) => {
      const axis = i % 3;
      const step = ((box.max[axis] as number) - (box.min[axis] as number)) / 65535;
      expect(Math.abs((back[i] as number) - v)).toBeLessThanOrEqual(step / 2 + 1e-3);
    });
  });

  test('clamps points outside the bbox', () => {
    const q = quantize(new Float32Array([-5, 500, 0]), box);
    expect(Array.from(q)).toEqual([0, 65535, 0]);
  });
});

describe('skeletons chunk', () => {
  const big = 2 ** 32 + 12345; // neuPrint bodyIds exceed u32
  const cns: BBox = { min: [-1000, -1000, -1000], max: [1000, 1000, 1000] };

  test('roundtrip of several neurons', () => {
    const a = ytree();
    const b = swc('1 1 0 0 0 70000 -1', '2 0 3 4 0 1.6 1');
    const bytes = encodeSkeletons(
      [
        { bodyId: big, skeleton: a },
        { bodyId: 7, skeleton: b },
      ],
      cns,
    );
    expect(decodeChunk(bytes).kind).toBe('skeletons');

    const set = decodeSkeletons(bytes, cns);
    expect(set.bodyIds).toEqual([big, 7]);
    expect(Array.from(set.offsets)).toEqual([0, 6, 8]);
    expect(Array.from(set.parent)).toEqual([...parents(a), ...parents(b)]);
    expect(Array.from(set.radius)).toEqual([5, 2, 1, 1, 1, 1, 65535, 2]);

    const step = 2000 / 65535;
    const src = [...a.pos, ...b.pos];
    src.forEach((v, i) => {
      expect(Math.abs((set.pos[i] as number) - v)).toBeLessThanOrEqual(step / 2 + 1e-3);
    });

    const dist = [...pathDistance(a), ...pathDistance(b)];
    dist.forEach((v, i) => {
      expect(Math.abs((set.dist[i] as number) - v)).toBeLessThan(0.1);
    });
  });

  test('empty list', () => {
    const set = decodeSkeletons(encodeSkeletons([], cns), cns);
    expect(set.bodyIds).toEqual([]);
    expect(Array.from(set.offsets)).toEqual([0]);
    expect(set.pos.length).toBe(0);
  });

  test('rejects a chunk of another kind', () => {
    expect(() => decodeSkeletons(encodeChunk('cloud', [new Uint16Array(3)]), cns)).toThrow(/skeletons/);
  });
});
