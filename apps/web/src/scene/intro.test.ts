import { describe, expect, it } from 'vitest';
import {
  bezierLut,
  cubicBezier,
  EASE_IN_OUT,
  EASE_OUT,
  INTRO,
  introTimeline,
  lerpPose,
  posePosition,
} from './intro';

const DIVE_START = INTRO.assembleMs;
const DONE = DIVE_START + INTRO.diveMs;

describe('cubicBezier', () => {
  it('hits the end points', () => {
    for (const f of [EASE_OUT, EASE_IN_OUT]) {
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(1);
    }
  });

  it('clamps outside 0..1', () => {
    expect(EASE_OUT(-0.5)).toBe(0);
    expect(EASE_OUT(2)).toBe(1);
  });

  it('is the identity for the linear curve', () => {
    const lin = cubicBezier(0.25, 0.25, 0.75, 0.75);
    for (const t of [0.1, 0.37, 0.5, 0.9]) expect(lin(t)).toBeCloseTo(t, 5);
  });

  it('is monotonic', () => {
    for (const f of [EASE_OUT, EASE_IN_OUT]) {
      let prev = 0;
      for (let i = 1; i <= 200; i++) {
        const y = f(i / 200);
        expect(y).toBeGreaterThanOrEqual(prev);
        prev = y;
      }
    }
  });

  it('matches the curve shape', () => {
    // strong ease-out: most of the travel in the first quarter
    expect(EASE_OUT(0.25)).toBeGreaterThan(0.7);
    expect(EASE_IN_OUT(0.2)).toBeLessThan(0.1);
  });

  it('agrees with dense parametric sampling', () => {
    // (x(s), y(s)) of cubic-bezier(0.77, 0, 0.175, 1); pick s with x(s) ≈ query
    const b = (p1: number, p2: number, s: number) =>
      3 * (1 - s) ** 2 * s * p1 + 3 * (1 - s) * s * s * p2 + s ** 3;
    for (const q of [0.3, 0.5, 0.7]) {
      let best = 0;
      for (let i = 0; i <= 1e5; i++) {
        const s = i / 1e5;
        if (Math.abs(b(0.77, 0.175, s) - q) < Math.abs(b(0.77, 0.175, best) - q)) best = s;
      }
      expect(EASE_IN_OUT(q)).toBeCloseTo(b(0, 1, best), 3);
    }
  });
});

describe('bezierLut', () => {
  it('samples the curve at n evenly spaced points', () => {
    const lut = bezierLut(EASE_OUT, 5);
    expect(lut).toHaveLength(5);
    expect(lut[0]).toBe(0);
    expect(lut[4]).toBe(1);
    expect(lut[2]).toBeCloseTo(EASE_OUT(0.5), 6);
  });
});

describe('introTimeline', () => {
  it('assembles from zero', () => {
    const s = introTimeline(0, 0);
    expect(s).toMatchObject({ phase: 'assemble', assembleMs: 0, dive: 0, reveal: 0 });
  });

  it('dives once assembly ends when data was ready early', () => {
    const s = introTimeline(DIVE_START + INTRO.diveMs / 2, 0);
    expect(s.phase).toBe('dive');
    expect(s.assembleMs).toBe(INTRO.assembleMs);
    expect(s.dive).toBeCloseTo(EASE_IN_OUT(0.5));
    expect(s.reveal).toBeGreaterThan(0);
  });

  it('holds the silhouette until data is ready', () => {
    const s = introTimeline(DIVE_START + 5000, Number.POSITIVE_INFINITY);
    expect(s).toMatchObject({ phase: 'assemble', assembleMs: INTRO.assembleMs, dive: 0, reveal: 0 });
    const late = introTimeline(DIVE_START + 5000 + INTRO.revealMs, DIVE_START + 5000);
    expect(late.phase).toBe('dive');
    expect(late.reveal).toBe(1);
  });

  it('finishes at the end of the dive', () => {
    expect(introTimeline(DONE, 0)).toMatchObject({ phase: 'done', dive: 1, reveal: 1 });
  });
});

describe('poses', () => {
  const a = { radius: 100, azimuth: -0.5, elevation: 0.2 };
  const b = { radius: 25, azimuth: 0, elevation: 0 };

  it('returns the end poses at k = 0 and 1', () => {
    expect(lerpPose(a, b, 0)).toEqual(a);
    const end = lerpPose(a, b, 1);
    expect(end.radius).toBeCloseTo(25);
    expect(end.azimuth).toBeCloseTo(0);
    expect(end.elevation).toBeCloseTo(0);
  });

  it('dollies in log space (constant perceived speed)', () => {
    expect(lerpPose(a, b, 0.5).radius).toBeCloseTo(50);
  });

  it('takes the short way round', () => {
    const wound = { ...a, azimuth: 2 * Math.PI - 0.5 };
    expect(lerpPose(wound, b, 0.5).azimuth % (2 * Math.PI)).toBeCloseTo(2 * Math.PI - 0.25);
  });

  it('places azimuth 0 / elevation 0 on +z', () => {
    const [x, y, z] = posePosition(b);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(25);
    const [, up] = posePosition({ radius: 10, azimuth: 0, elevation: Math.PI / 2 });
    expect(up).toBeCloseTo(10);
  });
});
