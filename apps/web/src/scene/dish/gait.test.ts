import { describe, expect, it } from 'vitest';
import { feet, LEG_COUNT, STRIDE, TRIPOD } from './gait';

describe('tripod gait', () => {
  it('moves the two tripods in antiphase', () => {
    for (const p of [0.1, 0.3, 0.6, 0.85]) {
      const f = feet(p);
      for (let i = 0; i < LEG_COUNT; i++)
        for (let j = 0; j < LEG_COUNT; j++)
          if (TRIPOD[i] !== TRIPOD[j]) expect((f[i]?.lift ?? 0) * (f[j]?.lift ?? 0)).toBe(0);
    }
    expect(feet(0.25).filter((f) => f.lift > 0)).toHaveLength(3);
  });

  it('keeps a stance foot still in the world while the body walks', () => {
    const dist = 0.1; // body units, inside one stance
    const a = feet(0.05);
    const b = feet(0.05 + dist / STRIDE);
    for (let i = 0; i < LEG_COUNT; i++)
      if ((a[i]?.lift ?? 1) === 0 && (b[i]?.lift ?? 1) === 0)
        expect((b[i]?.dx ?? 0) + dist).toBeCloseTo(a[i]?.dx ?? 0, 6);
  });

  it('is periodic and works backwards', () => {
    expect(feet(1.3)).toEqual(feet(0.3).map((f) => expect.objectContaining({ dx: expect.closeTo(f.dx, 9) })));
    expect(feet(-0.7).map((f) => f.dx)).toEqual(feet(0.3).map((f) => expect.closeTo(f.dx, 9)));
  });
});
