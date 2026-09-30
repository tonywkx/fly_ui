import { expect, test } from 'vitest';
import { FORMAT_VERSION } from './index';

test('format version is set', () => {
  expect(FORMAT_VERSION).toBeGreaterThan(0);
});
