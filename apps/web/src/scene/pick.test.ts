import { describe, expect, it } from 'vitest';
import { decodeIds, nearestHit } from './pick';

/** w×h window, zeros except `hits` ([x, y, row]); ids are stored as row + 1. */
function win(w: number, h: number, hits: [number, number, number][]) {
  const buf = new Float32Array(w * h);
  for (const [x, y, row] of hits) buf[y * w + x] = row + 1;
  return buf;
}

describe('nearestHit', () => {
  it('returns null for an empty window', () => {
    expect(nearestHit(win(5, 5, []), 5, 5)).toBeNull();
  });

  it('returns the row under the centre', () => {
    expect(nearestHit(win(5, 5, [[2, 2, 7]]), 5, 5)).toBe(7);
  });

  it('decodes row 0 (stored as 1)', () => {
    expect(nearestHit(win(3, 3, [[0, 0, 0]]), 3, 3)).toBe(0);
  });

  it('picks the hit closest to the centre', () => {
    const buf = win(9, 9, [
      [0, 0, 1],
      [6, 4, 2],
      [4, 7, 3],
    ]);
    expect(nearestHit(buf, 9, 9)).toBe(2);
  });

  it('measures distance in 2D, not along the scan', () => {
    // (1,3) is scanned first but ≈3.2 px away; (4,6) is 2 px away
    expect(
      nearestHit(
        win(9, 9, [
          [1, 3, 5],
          [4, 6, 6],
        ]),
        9,
        9,
      ),
    ).toBe(6);
  });

  it('breaks ties by scan order', () => {
    const buf = win(5, 5, [
      [2, 1, 4],
      [2, 3, 9],
    ]);
    expect(nearestHit(buf, 5, 5)).toBe(4);
  });
});

describe('decodeIds', () => {
  it('unpacks rgb bytes little-endian into ids, ignoring alpha', () => {
    const rgba = Uint8Array.from([0, 0, 0, 255, 1, 0, 0, 255, 0x34, 0x12, 0, 255, 0xff, 0xff, 0xff, 0]);
    expect([...decodeIds(rgba)]).toEqual([0, 1, 0x1234, 0xffffff]);
  });
});
