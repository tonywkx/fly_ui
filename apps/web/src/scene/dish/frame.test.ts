import { describe, expect, it } from 'vitest';
import { type Band, frame, GUTTER, type Lens, NO_BAND, SPREAD } from './frame';

const LENS: Lens = { fov: 30, pitch: 40, diameter: 10, fillH: 0.6, fillW: 0.92 };
const band = (b: Partial<Band>): Band => ({ ...NO_BAND, ...b });

/** The fit before side chrome was measured (DishScene.fit, 8.14). */
function legacy(w: number, h: number) {
  const tan = Math.tan((LENS.fov * Math.PI) / 360);
  const pitch = (LENS.pitch * Math.PI) / 180;
  return Math.max(
    (LENS.diameter * Math.sin(pitch)) / LENS.fillH / (2 * tan),
    LENS.diameter / LENS.fillW / (2 * tan * (w / h)),
  );
}

/** Screen px the dish's diameter spans at distance `dist`. */
const span = (w: number, h: number, dist: number) =>
  (LENS.diameter / (2 * dist * Math.tan((LENS.fov * Math.PI) / 360) * (w / h))) * w;

describe('frame', () => {
  it('keeps the old fit with no chrome', () => {
    for (const [w, h] of [
      [1600, 1000],
      [1280, 800],
      [390, 844],
    ] as const) {
      const f = frame(w, h, NO_BAND, LENS);
      expect(f.dist).toBeCloseTo(legacy(w, h), 9);
      expect(f.x).toBe(0);
      expect(f.y).toBe(0);
    }
  });

  it('lifts the picture between top and bottom chrome like the phone band', () => {
    const f = frame(390, 844, band({ top: 100, bottom: 400 }), LENS);
    expect(f.y).toBe(150);
    expect(f.x).toBe(0);
    expect(f.dist).toBeCloseTo(legacy(390, 844), 9);
  });

  it('fits the dish between the side columns', () => {
    const b = band({ left: 312, right: 390 });
    const f = frame(1280, 800, b, LENS);
    expect(f.dist).toBeGreaterThan(legacy(1280, 800));
    expect(span(1280, 800, f.dist)).toBeCloseTo((1280 - 312 - 390 - 2 * GUTTER) / SPREAD, 6);
  });

  it('centres the dish in the free band', () => {
    // wider left column → the picture moves right: the view window slides left (x < 0)
    expect(frame(1280, 800, band({ left: 312, right: 200 }), LENS).x).toBe(-56);
    expect(frame(1280, 800, band({ left: 100, right: 300 }), LENS).x).toBe(100);
  });

  it('does not grow the dish when the columns leave room', () => {
    const f = frame(2400, 1000, band({ left: 312, right: 390 }), LENS);
    expect(f.dist).toBeCloseTo(legacy(2400, 1000), 9);
  });

  it('keeps a floor share of the width for wide columns (tablets)', () => {
    const f = frame(800, 900, band({ left: 312, right: 390 }), LENS);
    expect(span(800, 900, f.dist)).toBeGreaterThanOrEqual(800 * 0.3 - 1e-6);
  });
});
