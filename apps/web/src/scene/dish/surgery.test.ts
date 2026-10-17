import type { NeuropilSet } from '@fly/data';
import { describe, expect, it } from 'vitest';
import { approach, boxOf, chosen, grown, PULSE, QUIET, rangeOf, regionLook, tagDots, wholeRim } from './surgery';

const panic = { region: 'PVLP', mode: 'off' } as const;
const moon = { region: 'LAL', mode: 'on' } as const;

describe('surgery on the hologram', () => {
  it('a hovered row lights its region in bone; others stay quiet', () => {
    expect(regionLook('PVLP', panic, null)).toMatchObject({ tint: 'bone', dust: 1 });
    expect(regionLook('PVLP', panic, null).rim).toBeGreaterThan(QUIET.rim);
    expect(regionLook('LAL', panic, null)).toEqual(QUIET);
    expect(regionLook('PVLP', null, null)).toEqual(QUIET);
  });

  it('an op in force marks its region: off = ash and dim dust, on = saffron', () => {
    expect(regionLook('PVLP', null, panic)).toMatchObject({ tint: 'ash', dust: 0.25 });
    expect(regionLook('LAL', null, moon)).toMatchObject({ tint: 'saffron', dust: 1 });
    expect(regionLook('LAL', null, moon).rim).toBeGreaterThan(QUIET.rim);
  });

  it('hovering the operated region lights it, its dust stays dim', () => {
    expect(regionLook('PVLP', panic, panic)).toMatchObject({ tint: 'bone', dust: 0.25 });
  });

  it('the brain row lights the whole shell, no region', () => {
    expect(regionLook('PVLP', 'all', null)).toEqual(QUIET);
    expect(wholeRim('all')).toBeGreaterThan(1);
    expect(wholeRim(panic)).toBe(1);
    expect(wholeRim(null)).toBe(1);
  });

  it('the choose pulse starts brighter than any mark', () => {
    expect(PULSE.rim).toBeGreaterThan(regionLook('LAL', null, moon).rim);
    expect(PULSE.tint).toBe('bone');
  });

  it('pulses a choice, not an op the hologram finds already in force', () => {
    expect(chosen(undefined, panic)).toBe(false); // first show: a remembered op, a return from the brain
    expect(chosen(null, panic)).toBe(true);
    expect(chosen(panic, moon)).toBe(true);
    expect(chosen(panic, { ...panic })).toBe(false);
    expect(chosen(panic, null)).toBe(false);
  });

  it('approaches its target, at once with no time constant', () => {
    expect(approach(0, 1, 0, 100)).toBe(0);
    const a = approach(0, 1, 100, 100);
    expect(a).toBeCloseTo(1 - Math.exp(-1));
    expect(approach(a, 1, 1e6, 100)).toBeCloseTo(1);
    expect(approach(0.3, 1, 16, 0)).toBe(1);
    // interruptible: from wherever it is now
    expect(approach(1.4, 1, 100, 100)).toBeLessThan(1.4);
  });

  it('grows while the list is open: less on a phone', () => {
    expect(grown(false, false)).toBe(1);
    expect(grown(true, false)).toBe(1.8);
    expect(grown(true, true)).toBe(1.5);
  });

  it('finds a region mesh by the left side, else unpaired', () => {
    const set: NeuropilSet = {
      pos: Float32Array.of(0, 0, 0, 2, 4, 6, 10, 10, 10, 20, 20, 20),
      index: new Uint32Array(0),
      ranges: [
        { name: 'PVLP(R)', vertStart: 2, vertCount: 1, indexStart: 0, indexCount: 0 },
        { name: 'PVLP(L)', vertStart: 0, vertCount: 2, indexStart: 0, indexCount: 0 },
        { name: 'GNG', vertStart: 3, vertCount: 1, indexStart: 0, indexCount: 0 },
      ],
    };
    expect(rangeOf(set, 'PVLP')?.name).toBe('PVLP(L)');
    expect(rangeOf(set, 'GNG')?.name).toBe('GNG');
    expect(rangeOf(set, 'LAL')).toBeNull();
    const r = rangeOf(set, 'PVLP');
    expect(r && boxOf(set, r)).toEqual({ min: [0, 0, 0], max: [2, 4, 6] });
  });

  it('tags each dot with the first box that holds it', () => {
    const dots = Float32Array.of(1, 1, 1, 5, 5, 5, 9, 9, 9);
    const boxes = [
      { min: [0, 0, 0], max: [2, 2, 2] },
      { min: [4, 4, 4], max: [10, 10, 10] },
    ] as const;
    expect([...tagDots(dots, boxes)]).toEqual([1, 2, 2]);
    expect([...tagDots(Float32Array.of(3, 3, 3), boxes)]).toEqual([0]);
  });
});
