/**
 * Screenshot any app state for visual verification.
 *   pnpm snap --scenario=escape --t=40 --debug=soma-dist [--w=1600 --h=1000 --name=x --url=http://...]
 * Every --key=value (except w/h/name/url/found/click) becomes a query param. Prints the PNG path.
 * --found=sugar:none,swatter:panic|all seeds the discoveries journal (`fly_ui.found`);
 * --click=<button name> clicks that button once the page is ready.
 * The page must set window.__snapReady = true once the requested state is rendered.
 */
import { mkdirSync } from 'node:fs';
import { NORM } from '../apps/web/src/scene/dish/table';
import { devServer, launch, parseArgs } from './lib';

const own = new Set(['w', 'h', 'name', 'url', 'found', 'click']);
const ALL =
  'sugar:none,bitter:none,shadow:none,female:none,swatter:panic,sugar:sugar,female:p1,none:moon,shadow:panic,sugar:moon,female:moon,bitter:sugar';
const args = parseArgs();

// English unless `--lang=ru`: scripts and smoke query English aria names
const query = new URLSearchParams({ snap: '1', lang: 'en' });
for (const [k, v] of Object.entries(args)) if (!own.has(k)) query.set(k, v);

const { base, stop } = await devServer(args.url, 5199);
const browser = await launch();
try {
  const page = await browser.newPage({
    viewport: { width: Number(args.w ?? 1600), height: Number(args.h ?? 1000) },
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  if (args.found) {
    const ids = (args.found === 'all' ? ALL : args.found).split(',');
    // the norm table's run per pair, bet on the normal fly
    const pairs = Object.fromEntries(
      ids.map((id) => {
        const [stim, op] = id.split(':') as [keyof typeof NORM, keyof (typeof NORM)['sugar']];
        const n = NORM[stim][op];
        return [id, { bet: NORM[stim].none.action, result: n.hit ? 'hit' : n.action, ms: n.ms, hz: n.hz }];
      }),
    );
    await page.addInitScript(
      (j) => localStorage.setItem('fly_ui.found', j),
      JSON.stringify({ pairs, last: null }),
    );
  }
  await page.goto(`${base}?${query}`);
  await page.waitForFunction(() => (window as { __snapReady?: boolean }).__snapReady === true, null, {
    timeout: 60_000,
  });

  if (args.click) {
    await page.getByRole('button', { name: args.click }).first().click();
    await page.waitForTimeout(400);
  }

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
  stop();
}
