/**
 * Screenshot any app state for visual verification.
 *   pnpm snap --scenario=escape --t=40 --debug=soma-dist [--w=1600 --h=1000 --name=x --url=http://...]
 * Every --key=value (except w/h/name/url) becomes a query param. Prints the PNG path.
 * The page must set window.__snapReady = true once the requested state is rendered.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5199;
const own = new Set(['w', 'h', 'name', 'url']);
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v = '1'] = a.slice(2).split('=');
      return [k, v] as [string, string];
    }),
);

const query = new URLSearchParams({ snap: '1' });
for (const [k, v] of Object.entries(args)) if (!own.has(k)) query.set(k, v);

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
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({
    viewport: { width: Number(args.w ?? 1600), height: Number(args.h ?? 1000) },
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${base}?${query}`);
  await page.waitForFunction(() => (window as { __snapReady?: boolean }).__snapReady === true, null, {
    timeout: 60_000,
  });

  mkdirSync('snaps', { recursive: true });
  const name =
    args.name ??
    ([...query.entries()]
      .filter(([k]) => k !== 'snap')
      .map((e) => e.join('-'))
      .join('_') ||
      'home');
  const file = `snaps/${name}.png`;
  await page.screenshot({ path: file });
  console.log(file);
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
