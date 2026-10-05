/**
 * Frame-exact demo video: Playwright's fake clock steps rAF / performance.now by 1/fps, every
 * step is screenshotted, ffmpeg joins the shots with crossfades.
 *   pnpm film [--shot=escape] [--sec=2] [--fps=60] [--w=1920 --h=1080] [--url=http://...] [--join]
 * → snaps/film/<shot>/%05d.png; all shots → snaps/fly_ui.mp4 (master, ~35 Mbit/s: dust is noise to
 * the codec) + snaps/fly_ui.web.mp4 (30 fps, ≤ WEB_MB for GitHub uploads). --join re-encodes only.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import type { Browser } from 'playwright';
import { devServer, launch, parseArgs } from './lib';

interface Shot {
  name: string;
  query: Record<string, string>;
  /** Record the load + intro too (the opening shot); later shots start once the dive has landed. */
  intro: boolean;
  /** Seconds recorded after Play. */
  sec: number;
}

const SHOTS: Shot[] = [
  { name: 'escape', query: { scenario: 'escape', director: '1' }, intro: true, sec: 13 },
  { name: 'sugar', query: { scenario: 'sugar', director: '1' }, intro: false, sec: 12 },
  { name: 'song', query: { scenario: 'song', director: '1' }, intro: false, sec: 15 },
];
/** Ready → dive landed (scene/intro.ts INTRO: assembly tail + dive), with a beat to settle. */
const INTRO_MS = 4000;
const FADE = 0.6;
const WEB_MB = 9;

const args = parseArgs();
const fps = Number(args.fps ?? 60);
const w = Number(args.w ?? 1920);
const h = Number(args.h ?? 1080);
const shots = SHOTS.filter((s) => !args.shot || s.name === args.shot).map((s) =>
  args.sec ? { ...s, sec: Number(args.sec) } : s,
);
if (!shots.length) throw new Error(`unknown shot "${args.shot}" (${SHOTS.map((s) => s.name).join(' | ')})`);

if (!args.join) {
  const { base, stop } = await devServer(args.url, 5196);
  const browser = await launch();
  try {
    for (const shot of shots) await film(shot, base, browser);
  } finally {
    await browser.close();
    stop();
  }
}
if (shots.length > 1) web(join(shots));

async function film(shot: Shot, base: string, browser: Browser) {
  const dir = `snaps/film/${shot.name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log(`[${shot.name}] page error: ${e.message}`));
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.goto(`${base}?${new URLSearchParams({ quality: 'high', lang: 'en', ...shot.query })}`);

  const step = 1000 / fps;
  let frame = 0;
  const shoot = () => page.screenshot({ path: `${dir}/${String(frame++).padStart(5, '0')}.png` });
  const tick = async (rec: boolean) => {
    await page.clock.runFor(step);
    if (rec) await shoot();
    else await page.waitForTimeout(2);
  };
  // loading is real time (fetch, workers): keep frames ticking until the app reports ready
  const ready = () => page.evaluate(() => (window as { __snapReady?: boolean }).__snapReady === true);
  for (let i = 0; !(await ready()); i++) {
    if (i > 3000) throw new Error(`[${shot.name}] not ready`);
    await tick(shot.intro);
  }
  // hold the sim at its start while the brain assembles, play once the camera has landed
  await page.getByRole('slider', { name: 'Sim time' }).press('Home');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(w - 1, h / 2);
  for (let ms = 0; ms < INTRO_MS; ms += step) await tick(shot.intro);
  await page.getByRole('button', { name: 'Play' }).click();
  await page.mouse.move(w - 1, h / 2);
  const total = frame + Math.round(shot.sec * fps);
  const t0 = Date.now();
  while (frame < total) {
    await tick(true);
    if (frame % fps === 0) process.stdout.write(`\r[${shot.name}] ${frame}/${total}`);
  }
  console.log(`\r[${shot.name}] ${frame} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${dir}`);
  await page.close();
}

function join(list: Shot[]): number {
  const out = 'snaps/fly_ui.mp4';
  const inputs = list.flatMap((s) => ['-framerate', String(fps), '-i', `snaps/film/${s.name}/%05d.png`]);
  // chain xfades: each offset = running length − FADE
  const secs = list.map((s) => readdirSync(`snaps/film/${s.name}`).length / fps);
  const parts: string[] = [];
  let prev = '[0:v]';
  let len = secs[0] ?? 0;
  for (let i = 1; i < list.length; i++) {
    const label = i === list.length - 1 ? '[v]' : `[x${i}]`;
    parts.push(
      `${prev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${(len - FADE).toFixed(3)}${label}`,
    );
    len += (secs[i] ?? 0) - FADE;
    prev = label;
  }
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      ...inputs,
      '-filter_complex',
      `${parts.join(';')};[v]format=yuv420p[o]`,
      '-map',
      '[o]',
      '-c:v',
      'libx264',
      '-crf',
      '20',
      '-preset',
      'slow',
      '-movflags',
      '+faststart',
      out,
    ],
    { stdio: 'inherit' },
  );
  console.log(`${out} (${len.toFixed(1)} s)`);
  return len;
}

/** Two-pass to a size cap; 30 fps leaves twice the bits per frame for the dust. */
function web(sec: number) {
  const kbps = Math.floor((WEB_MB * 8 * 1024 * 1024) / sec / 1000);
  const rate = ['-b:v', `${kbps}k`, '-maxrate', `${kbps * 2}k`, '-bufsize', `${kbps * 4}k`];
  const common = ['-y', '-loglevel', 'error', '-i', 'snaps/fly_ui.mp4', '-r', '30', '-an'];
  const x264 = ['-c:v', 'libx264', '-preset', 'slow', ...rate, '-passlogfile', 'snaps/film/x264'];
  execFileSync('ffmpeg', [...common, ...x264, '-pass', '1', '-f', 'mp4', '/dev/null'], { stdio: 'inherit' });
  execFileSync(
    'ffmpeg',
    [...common, ...x264, '-pass', '2', '-movflags', '+faststart', 'snaps/fly_ui.web.mp4'],
    {
      stdio: 'inherit',
    },
  );
  console.log(`snaps/fly_ui.web.mp4 (${kbps} kbit/s)`);
}
