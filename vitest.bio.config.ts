import { defineConfig } from 'vitest/config';

/** Slow full-graph biology checks (pnpm test:bio); needs data/cache. */
export default defineConfig({
  test: {
    include: ['apps/pipeline/src/**/*.bio.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
