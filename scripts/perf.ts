/**
 * Frame-rate probe for quality presets.
 *   pnpm perf --quality=high [--gl=webgl2 --scenario=escape --secs=6 --dpr=2 --w=1600 --h=1000 --url=http://...]
 * Opens the app like a snap (intro skipped, preset pinned, fake activity running), waits until it is
 * drawn, warms up 1 s, then records rAF intervals. Prints fps and frame-time percentiles.
 * Headless Chromium on the real GPU — a guide, not a substitute for `?stats=1` in a real window.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 5198;
const own = new Set(['w', 'h', 'url', 'secs', 'dpr']);
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v = '1'] = a.slice(2).split('=');
      return [k, v] as [string, string];
    }),
);

const query = new URLSearchParams({ snap: '1', scenario: 'escape', stats: '1' });
for (const [k, v] of Object.entries(args)) if (!own.has(k)) query.set(k, v);
const secs = Number(args.secs ?? 6);

let server: ChildProcess | undefined;
let base = args.url;
if (!base) {
  server = spawn('pnpm', ['--filter', 'web', 'exec', 'vite', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
  });
  base = `http://localhost:${PORT}/`;
  await waitFor(base, 30_000);
}

const browser = await chromium.launch({
  // vsync stays on: uncapped runs stall for seconds and inflate cpu ms through GPU backpressure
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({
    viewport: { width: Number(args.w ?? 1600), height: Number(args.h ?? 1000) },
    deviceScaleFactor: Number(args.dpr ?? 2),
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${base}?${query}`);
  await page.waitForFunction(() => (window as { __snapReady?: boolean }).__snapReady === true, null, {
    timeout: 60_000,
  });

  // a string, not a function: tsx (esbuild keepNames) would inject an undefined `__name` helper
  const dts: number[] = await page.evaluate(`new Promise((resolve) => {
    const out = [];
    let last = -1, start = -1;
    const tick = (now) => {
      if (start < 0) start = now;
      const t = now - start;
      if (t > 1000 && last >= 0) out.push(now - last); // 1 s warm-up
      last = now;
      if (t < 1000 + ${secs * 1000}) requestAnimationFrame(tick);
      else resolve(out);
    };
    requestAnimationFrame(tick);
  })`);

  const gpu: string = await page.evaluate(`(async () => {
    const a = await navigator.gpu?.requestAdapter();
    const i = a?.info;
    return i ? [i.vendor, i.architecture, i.description].filter(Boolean).join(' / ') : 'no webgpu adapter';
  })()`);

  // CPU ms of renderer.render, from the ?stats overlay (last 500 ms window)
  const cpu: string = await page.evaluate(`document.body.innerText.match(/([\\d.]+)\\s*ms/)?.[1] ?? '?'`);

  const sorted = [...dts].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  const mean = dts.reduce((a, b) => a + b, 0) / (dts.length || 1);
  const label = [...query.entries()]
    .filter(([k]) => k !== 'snap' && k !== 'stats')
    .map((e) => e.join('='))
    .join(' ');
  console.log(
    `${label}  fps ${(1000 / mean).toFixed(1)}  frame ms p50 ${pct(0.5).toFixed(1)} p95 ${pct(0.95).toFixed(1)} max ${pct(1).toFixed(1)}  cpu render ${cpu} ms  (${dts.length} frames)`,
  );
  console.log(`  gpu: ${gpu}`);
  if (errors.length) console.log(`page errors (${errors.length}):\n${errors.slice(0, 5).join('\n')}`);
} finally {
  await browser.close();
  server?.kill();
}

async function waitFor(url: string, ms: number) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`dev server not up: ${url}`);
}
