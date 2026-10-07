import { describe, expect, it } from 'vitest';
import { FADE_MS, TRAIL_RGB, Trail } from './trail';

const segs = (t: Trail, now: number) => {
  const pos = new Float32Array(t.capacity * 6);
  const rgb = new Float32Array(t.capacity * 6);
  const n = t.fill(now, pos, rgb);
  return { n, pos, rgb };
};

describe('Trail', () => {
  it('joins points into segments coloured by action, dimming with age', () => {
    const t = new Trail(16);
    t.push(0, 0, 0, 'walk');
    t.push(100, 1, 0, 'walk');
    t.push(200, 2, 0, 'back');
    const { n, pos, rgb } = segs(t, 200);
    expect(n).toBe(2);
    expect([...pos.slice(0, 6)].map((v) => v + 0)).toEqual([0, 0, 0, 1, 0, 0]);
    // newest segment: back blue at full strength at its newer end
    expect(rgb[9]).toBeCloseTo(TRAIL_RGB.back[0], 5);
    // older end of the first segment is dimmer than its newer end
    expect(rgb[0]).toBeLessThan(rgb[3] as number);
  });

  it('maps world y to scene −z', () => {
    const t = new Trail(4);
    t.push(0, 0, 0, 'walk');
    t.push(1, 0, 2, 'walk');
    const { pos } = segs(t, 1);
    expect(pos[5]).toBe(-2);
  });

  it('leaves a gap over a jump', () => {
    const t = new Trail(16);
    t.push(0, 0, 0, 'walk');
    t.push(10, 1, 0, 'walk');
    t.gap();
    t.push(500, 5, 5, 'walk');
    t.push(510, 6, 5, 'walk');
    expect(segs(t, 510).n).toBe(2);
  });

  it('drops points older than the fade and overwrites when full', () => {
    const t = new Trail(4);
    for (let i = 0; i < 10; i++) t.push(i, i, 0, 'walk');
    expect(segs(t, 9).n).toBe(3);
    expect(segs(t, 9 + FADE_MS).n).toBe(0);
  });
});
