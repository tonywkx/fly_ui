import { describe, expect, test } from 'vitest';
import { parseObj } from './obj';

describe('parseObj', () => {
  test('vertices and triangles, 1-based indices become 0-based', () => {
    const m = parseObj('# OBJ file\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n');
    expect(Array.from(m.pos)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(Array.from(m.index)).toEqual([0, 1, 2]);
  });

  test('a/b/c face refs, quads fan-triangulated, negative indices, junk lines skipped', () => {
    const m = parseObj(
      [
        'v 0 0 0',
        'v 1 0 0',
        'v 1 1 0',
        'v 0 1 0',
        'vn 0 0 1',
        'o x',
        'f 1/1/1 2//1 3/2 4',
        'f -4 -3 -1',
        '',
      ].join('\r\n'),
    );
    expect(m.pos.length).toBe(12);
    expect(Array.from(m.index)).toEqual([0, 1, 2, 0, 2, 3, 0, 1, 3]);
  });

  test('out-of-range face index throws', () => {
    expect(() => parseObj('v 0 0 0\nv 1 0 0\nf 1 2 3\n')).toThrow(/index/);
  });
});
