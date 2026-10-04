import { defineConfig } from '@playwright/test';

/**
 * Smoke tests on the production build (`vite preview` of apps/web/dist, rebuilt on start).
 * Local runs use the real GPU (WebGPU); CI has none, so pages there run `?gl=webgl2` on SwiftShader.
 */
const PORT = 5197;
const ci = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  timeout: ci ? 180_000 : 60_000,
  expect: { timeout: ci ? 30_000 : 10_000 },
  fullyParallel: !ci,
  workers: ci ? 1 : undefined,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    browserName: 'chromium',
    viewport: { width: 1600, height: 1000 },
    launchOptions: {
      args: ci
        ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
        : ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: `pnpm build && pnpm --filter web exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !ci,
    timeout: 180_000,
  },
});
