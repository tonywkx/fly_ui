import { describe, expect, it } from 'vitest';
import { facing, scenarioFor, ZOOM_MS, zoomAt } from './zoom';

describe('zoomAt', () => {
  it('flies in: dish framing → brain, the dish veiled, black at the seam', () => {
    const a = zoomAt(0, 'in', false);
    expect(a).toMatchObject({ k: 0, veil: 0, black: 0, done: false });
    const z = zoomAt(ZOOM_MS, 'in', false);
    expect(z).toMatchObject({ k: 1, veil: 1, black: 1, done: true });
    // the veil is down before the black starts: the last frames are the brain alone
    const mid = zoomAt(ZOOM_MS * 0.86, 'in', false);
    expect(mid.veil).toBe(1);
    expect(mid.black).toBeLessThan(0.2);
  });

  it('travel, veil and black only grow on the way in', () => {
    let prev = zoomAt(0, 'in', false);
    for (let ms = 20; ms <= ZOOM_MS; ms += 20) {
      const s = zoomAt(ms, 'in', false);
      expect(s.k).toBeGreaterThanOrEqual(prev.k);
      expect(s.veil).toBeGreaterThanOrEqual(prev.veil);
      expect(s.black).toBeGreaterThanOrEqual(prev.black);
      prev = s;
    }
  });

  it('flies out as the mirror of in', () => {
    for (const ms of [0, 200, 700, 1300, ZOOM_MS]) {
      const o = zoomAt(ms, 'out', false);
      const i = zoomAt(ZOOM_MS - ms, 'in', false);
      expect(o.k).toBeCloseTo(i.k);
      expect(o.veil).toBeCloseTo(i.veil);
      expect(o.black).toBeCloseTo(i.black);
    }
    expect(zoomAt(ZOOM_MS, 'out', false).done).toBe(true);
  });

  it('reduced motion: no travel, a short fade', () => {
    const s = zoomAt(100, 'in', true);
    expect(s.k).toBe(0);
    expect(s.black).toBeGreaterThan(0);
    expect(zoomAt(400, 'in', true)).toMatchObject({ black: 1, done: true });
    expect(zoomAt(400, 'out', true)).toMatchObject({ black: 0, veil: 0, done: true });
  });

  it('clamps outside the flight', () => {
    expect(zoomAt(-5, 'in', false).k).toBe(0);
    expect(zoomAt(ZOOM_MS * 3, 'in', false).k).toBe(1);
  });
});

describe('facing', () => {
  it('puts the camera in front of the fly', () => {
    // heading 0 = +x in the world = +x in the scene; azimuth is about +y from +z
    const a = facing(0);
    expect(Math.sin(a)).toBeCloseTo(1);
    expect(Math.cos(a)).toBeCloseTo(0);
    // heading π/2 = world +y = scene −z
    const b = facing(Math.PI / 2);
    expect(Math.sin(b)).toBeCloseTo(0);
    expect(Math.cos(b)).toBeCloseTo(-1);
  });
});

describe('scenarioFor', () => {
  it('opens the brain on the circuit of the last decision', () => {
    expect(scenarioFor('jump')).toBe('escape');
    expect(scenarioFor('back')).toBe('escape');
    expect(scenarioFor('eat')).toBe('sugar');
    expect(scenarioFor('court')).toBe('song');
    expect(scenarioFor(null)).toBe('escape');
  });
});
