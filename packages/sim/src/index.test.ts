import { expect, test } from 'vitest';
import { LIF_DEFAULTS } from './index';

test('threshold is above rest', () => {
  expect(LIF_DEFAULTS.vThreshold).toBeGreaterThan(LIF_DEFAULTS.vRest);
});
