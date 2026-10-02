import { describe, expect, it } from 'vitest';
import { defaultQuality, downgrade, FpsGuard, isQuality, QUALITIES, QUALITY } from './quality';

describe('quality presets', () => {
  it('get no cheaper from low to high', () => {
    const { low, med, high } = QUALITY;
    expect(QUALITIES).toEqual(['low', 'med', 'high']);
    for (const [a, b] of [
      [low, med],
      [med, high],
    ] as const) {
      expect(a.dustTiers).toBeLessThanOrEqual(b.dustTiers);
      expect(a.pixelRatio).toBeLessThanOrEqual(b.pixelRatio);
      expect(+a.bloom).toBeLessThanOrEqual(+b.bloom);
      expect(+a.msaa).toBeLessThanOrEqual(+b.msaa);
    }
    expect(low.dustTiers).toBeGreaterThanOrEqual(1);
  });

  it('isQuality accepts only preset ids', () => {
    expect(isQuality('med')).toBe(true);
    expect(isQuality('ultra')).toBe(false);
    expect(isQuality(undefined)).toBe(false);
  });

  it('downgrade steps one level and floors at low', () => {
    expect(downgrade('high')).toBe('med');
    expect(downgrade('med')).toBe('low');
    expect(downgrade('low')).toBe('low');
  });
});

describe('defaultQuality', () => {
  const desktop = { backend: 'webgpu', coarsePointer: false, cores: 10 } as const;
  it('is high on a capable WebGPU desktop', () => {
    expect(defaultQuality(desktop)).toBe('high');
  });
  it('is med on the WebGL2 fallback', () => {
    expect(defaultQuality({ ...desktop, backend: 'webgl2' })).toBe('med');
  });
  it('is low on touch devices or few cores', () => {
    expect(defaultQuality({ ...desktop, coarsePointer: true })).toBe('low');
    expect(defaultQuality({ ...desktop, cores: 4 })).toBe('low');
    expect(defaultQuality({ ...desktop, backend: 'webgl2', cores: 2 })).toBe('low');
  });
});

describe('FpsGuard', () => {
  it('downgrades after three slow windows in a row', () => {
    const g = new FpsGuard();
    expect(g.sample(30, 'high')).toBeUndefined();
    expect(g.sample(30, 'high')).toBeUndefined();
    expect(g.sample(30, 'high')).toBe('med');
  });

  it('a good window resets the streak', () => {
    const g = new FpsGuard();
    g.sample(30, 'high');
    g.sample(30, 'high');
    g.sample(60, 'high');
    expect(g.sample(30, 'high')).toBeUndefined();
    expect(g.sample(30, 'high')).toBeUndefined();
    expect(g.sample(30, 'high')).toBe('med');
  });

  it('starts a fresh streak after a downgrade and stops at low', () => {
    const g = new FpsGuard();
    for (let i = 0; i < 3; i++) g.sample(20, 'high');
    expect(g.sample(20, 'med')).toBeUndefined();
    expect(g.sample(20, 'med')).toBeUndefined();
    expect(g.sample(20, 'med')).toBe('low');
    for (let i = 0; i < 5; i++) expect(g.sample(10, 'low')).toBeUndefined();
  });
});
