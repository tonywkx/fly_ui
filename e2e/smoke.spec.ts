import { expect, type Page, test } from '@playwright/test';

const SCENARIOS = ['escape', 'sugar', 'song'] as const;
/** CLAUDE.md budget: bytes on the wire before the first frame. */
const FIRST_FRAME_MB = 15;

/** Query string for a snap-mode page; CI has no GPU, so it always takes the WebGL2 path. */
function url(q: Record<string, string>) {
  const p = new URLSearchParams({ snap: '1', quality: 'low', ...q });
  if (process.env.CI) p.set('gl', 'webgl2');
  return `./?${p}`;
}

/** Collect uncaught errors and console.error; `bytes` counts response bodies (workers included). */
function watch(page: Page) {
  const errors: string[] = [];
  const bytes = { n: 0 };
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('requestfinished', async (r) => {
    bytes.n += (await r.sizes().catch(() => null))?.responseBodySize ?? 0;
  });
  return { errors, bytes };
}

const ready = (page: Page) =>
  page.waitForFunction(() => (window as { __snapReady?: boolean }).__snapReady === true);

const readout = (page: Page) =>
  page.getByRole('region', { name: 'Timeline' }).locator('p > span').first().textContent();

for (const scenario of SCENARIOS) {
  test(`${scenario} loads within budget`, async ({ page }) => {
    const { errors, bytes } = watch(page);
    await page.goto(url({ scenario }));
    await ready(page);
    const mb = bytes.n / 2 ** 20;
    test.info().annotations.push({ type: 'first frame', description: `${mb.toFixed(1)} MB` });
    expect(mb, `${mb.toFixed(1)} MB before first frame`).toBeLessThanOrEqual(FIRST_FRAME_MB);
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('play / pause moves the clock', async ({ page }) => {
  const { errors } = watch(page);
  await page.goto(url({ scenario: 'escape' }));
  await ready(page);
  const timeline = page.getByRole('region', { name: 'Timeline' });
  // DOM clicks: under SwiftShader a real click waits on a frame commit that can take tens of seconds
  if (await timeline.getByRole('button', { name: 'Pause' }).isVisible())
    await timeline.getByRole('button', { name: 'Pause' }).dispatchEvent('click');

  const stopped = await readout(page);
  await page.waitForTimeout(400);
  expect(await readout(page)).toBe(stopped);

  await timeline.getByRole('button', { name: 'Play' }).dispatchEvent('click');
  await expect.poll(() => readout(page)).not.toBe(stopped);
  expect(errors).toEqual([]);
});

// Links only, no navigation: under SwiftShader the busy page doesn't unload within 30 s,
// and the target load is covered by the scenario tests above.
test('phone viewer bar links the scenarios', async ({ page }) => {
  const { errors } = watch(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url({ scenario: 'escape' }));
  await ready(page);
  const nav = page.getByRole('navigation', { name: 'Scenarios' });
  await expect(nav).toBeVisible();
  await expect(nav.locator('a[aria-current=page]')).toHaveAttribute('href', /scenario=escape/);
  const song = new URLSearchParams(
    (await nav.locator('a[href*="scenario=song"]').getAttribute('href'))?.split('?')[1],
  );
  expect(song.get('quality')).toBe('low'); // view params survive the switch
  expect(song.has('snap')).toBe(false);
  expect(errors).toEqual([]);
});

test('data error shows the fatal screen', async ({ page }) => {
  await page.route('**/data/manifest.json', (r) => r.fulfill({ status: 500, body: 'down' }));
  await page.goto(url({ scenario: 'escape' }));
  await expect(page.getByRole('alert')).toBeVisible();
});
