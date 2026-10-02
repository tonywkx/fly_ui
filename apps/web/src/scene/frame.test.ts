import { describe, expect, it } from 'vitest';
import { frameDistance } from './frame';

const FOV90 = 90;

describe('frameDistance', () => {
  it('fits the vertical extent when the box is taller than the viewport', () => {
    // tan(45°) = 1: height 2 needs distance 2 to the front face, +3 to the centre
    expect(frameDistance([1, 2, 3], FOV90, 1, 1)).toBeCloseTo(5);
  });

  it('fits the horizontal extent on a narrow viewport', () => {
    // horizontal tan = 0.25 → half width 1 needs 4
    expect(frameDistance([1, 2, 3], FOV90, 0.25, 1)).toBeCloseTo(7);
  });

  it('scales the fitted extent by the margin, not the depth', () => {
    expect(frameDistance([1, 2, 3], FOV90, 1, 1.5)).toBeCloseTo(6);
  });
});
