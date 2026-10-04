/** Shared by snap / perf / film: CLI args, the dev server and a GPU-backed Chromium. */
import { type ChildProcess, spawn } from 'node:child_process';
import { chromium } from 'playwright';

/** `--k=v` (bare `--k` → '1'). */
export function parseArgs(argv = process.argv.slice(2)): Record<string, string> {
  return Object.fromEntries(
    argv
      .filter((a) => a.startsWith('--'))
      .map((a) => {
        const [k, v = '1'] = a.slice(2).split('=');
        return [k, v] as [string, string];
      }),
  );
}

/**
 * Vite dev server unless `url` is given; `stop` kills what was started.
 * Ports: snap 5199, perf 5198, smoke 5197 (preview), film 5196 — so they can run side by side.
 */
export async function devServer(
  url: string | undefined,
  port: number,
): Promise<{ base: string; stop: () => void }> {
  if (url) return { base: url, stop: () => {} };
  const server: ChildProcess = spawn(
    'pnpm',
    ['--filter', 'web', 'exec', 'vite', '--port', String(port), '--strictPort'],
    { stdio: 'ignore' },
  );
  const base = `http://localhost:${port}/`;
  await waitFor(base, 30_000);
  return { base, stop: () => server.kill() };
}

/** Real GPU (Metal) with WebGPU on. vsync stays on: uncapped runs stall through GPU backpressure. */
export const launch = () =>
  chromium.launch({
    args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
  });

export async function waitFor(url: string, ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`dev server not up: ${url}`);
}
