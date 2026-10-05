import { describe, expect, it } from 'vitest';
import { placeLabel, type Rect, shellSamples } from './anatomy';

const set = {
  // A: 4 verts, B: 2 verts
  pos: Float32Array.from([0, 0, 0, 2, 0, 0, 0, 4, 0, 2, 4, 6, 10, 10, 10, 12, 10, 10]),
  index: new Uint32Array(),
  ranges: [
    { name: 'A', vertStart: 0, vertCount: 4, indexStart: 0, indexCount: 0 },
    { name: 'B', vertStart: 4, vertCount: 2, indexStart: 0, indexCount: 0 },
  ],
};

describe('shellSamples', () => {
  it('centre is the vertex bbox centre; samples are capped', () => {
    const a = shellSamples(set, 'A', 2);
    expect(a?.centre).toEqual([1, 2, 3]);
    expect(a?.points.length).toBe(2 * 3);
    expect(shellSamples(set, 'B', 100)?.points).toEqual(Float32Array.from([10, 10, 10, 12, 10, 10]));
  });

  it('unknown name → undefined', () => {
    expect(shellSamples(set, 'C', 10)).toBeUndefined();
  });
});

describe('placeLabel', () => {
  const rect: Rect = { x0: 400, y0: 300, x1: 600, y1: 500 };
  const view = { w: 1600, h: 1000 };
  const size = { w: 120, h: 20 };

  it('left: right edge GAP left of the rect, vertically centred on the anchor', () => {
    const p = placeLabel(['left'], rect, [500, 400], size, view);
    expect(p.end[0]).toBeLessThan(400);
    expect(p.box.x + size.w).toBeLessThan(p.end[0]);
    expect(p.box.y + size.h / 2).toBeCloseTo(400);
  });

  it('above / below: centred on the anchor, clear of the rect', () => {
    const up = placeLabel(['above'], rect, [500, 400], size, view);
    expect(up.box.y + size.h).toBeLessThan(300);
    expect(up.box.x + size.w / 2).toBeCloseTo(500);
    const down = placeLabel(['below'], rect, [500, 400], size, view);
    expect(down.box.y).toBeGreaterThan(500);
  });

  it('right: left edge GAP right of the rect', () => {
    const p = placeLabel(['right'], rect, [500, 400], size, view);
    expect(p.end[0]).toBeGreaterThan(600);
    expect(p.box.x).toBeGreaterThan(p.end[0]);
  });

  it('falls back to the next side when the first has no room', () => {
    const edge: Rect = { x0: 10, y0: 300, x1: 100, y1: 500 };
    const p = placeLabel(['left', 'above'], edge, [50, 400], size, view);
    expect(p.box.y + size.h).toBeLessThan(300);
  });

  it('no side fits: the last one, pushed inside the viewport margin', () => {
    const p = placeLabel(['left'], { x0: 10, y0: 300, x1: 100, y1: 500 }, [50, 400], size, view);
    expect(p.box.x).toBe(16);
  });
});
