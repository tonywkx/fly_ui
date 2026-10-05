/**
 * Frame-rate probe for quality presets.
 *   pnpm perf --quality=high [--gl=webgl2 --scenario=escape --secs=6 --dpr=2 --w=1600 --h=1000 --profile --url=http://...]
 * --profile: main-thread CPU profile over the measured window, top functions by self time.
 * Opens the app like a snap (intro skipped, preset pinned, fake activity running), waits until it is
 * drawn, warms up 1 s, then records rAF intervals. Prints fps and frame-time percentiles.
 * Headless Chromium on the real GPU — a guide, not a substitute for `?stats=1` in a real window.
 */
import { devServer, launch, parseArgs } from './lib';

const own = new Set(['w', 'h', 'url', 'secs', 'dpr', 'profile']);
const args = parseArgs();

const query = new URLSearchParams({ snap: '1', scenario: 'escape', stats: '1', lang: 'en' });
for (const [k, v] of Object.entries(args)) if (!own.has(k)) query.set(k, v);
const secs = Number(args.secs ?? 6);

const { base, stop } = await devServer(args.url, 5198);
const browser = await launch();
try {
  const page = await browser.newPage({
    viewport: { width: Number(args.w ?? 1600), height: Number(args.h ?? 1000) },
    deviceScaleFactor: Number(args.dpr ?? 2),
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // bytes on the wire until the app is drawn (data/ = baked chunks; the rest is dev-server JS, not the build)
  const bytes = { data: 0, other: 0 };
  let drawn = false;
  page.on('requestfinished', async (r) => {
    if (drawn) return;
    const n = (await r.sizes().catch(() => null))?.responseBodySize ?? 0;
    bytes[new URL(r.url()).pathname.includes('/data/') ? 'data' : 'other'] += n;
  });

  await page.goto(`${base}?${query}`);
  await page.waitForFunction(() => (window as { __snapReady?: boolean }).__snapReady === true, null, {
    timeout: 60_000,
  });
  drawn = true;
  const cdp = args.profile ? await page.context().newCDPSession(page) : undefined;
  if (cdp) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.start');
  }

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

  if (cdp) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map<string, number>();
    const dt = profile.timeDeltas ?? [];
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    (profile.samples ?? []).forEach((id, i) => {
      const f = byId.get(id)?.callFrame;
      if (!f) return;
      const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()?.split('?')[0]}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
    });
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    console.log(`  cpu profile (self ms over ${(total / 1000).toFixed(1)} s):`);
    for (const [k, ms] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 15))
      console.log(`    ${ms.toFixed(0).padStart(6)}  ${k}`);
  }

  const gpu: string = await page.evaluate(`(async () => {
    const a = await navigator.gpu?.requestAdapter();
    const i = a?.info;
    return i ? [i.vendor, i.architecture, i.description].filter(Boolean).join(' / ') : 'no webgpu adapter';
  })()`);

  // CPU ms of renderer.render and the live preset/backend, from the ?stats overlay (last 500 ms window)
  const stat = (k: string) =>
    page.evaluate(`document.querySelector('[data-stat=${k}]')?.textContent.trim() ?? '?'`);
  const cpu = await stat('ms');
  const preset = await stat('preset');

  const sorted = [...dts].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  const mean = dts.reduce((a, b) => a + b, 0) / (dts.length || 1);
  const label = [...query.entries()]
    .filter(([k]) => k !== 'snap' && k !== 'stats')
    .map((e) => e.join('='))
    .join(' ');
  console.log(
    `${label}  fps ${(1000 / mean).toFixed(1)}  frame ms p50 ${pct(0.5).toFixed(1)} p95 ${pct(0.95).toFixed(1)} max ${pct(1).toFixed(1)}  cpu render ${cpu} ms  (${dts.length} frames, ${preset})`,
  );
  const mb = (n: number) => (n / 1e6).toFixed(1);
  console.log(`  gpu: ${gpu}`);
  console.log(`  until drawn: data ${mb(bytes.data)} MB, other ${mb(bytes.other)} MB (dev, unminified)`);
  if (errors.length) console.log(`page errors (${errors.length}):\n${errors.slice(0, 5).join('\n')}`);
} finally {
  await browser.close();
  stop();
}
