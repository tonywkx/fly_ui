import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { env } from './env';
import { fetchSkeletons, randomBodyIds, scoutBodyIds } from './fetch/skeletons';
import { clientFromEnv } from './neuprint/fromEnv';

const { values } = parseArgs({
  options: {
    scenario: { type: 'string', multiple: true },
    /** Extra random bodies from the whole CNS (background cloud, PLAN 1.5). */
    random: { type: 'string' },
    seed: { type: 'string', default: '1' },
  },
});

const scoutDir = join(env.root, 'data/scout');
const dir = join(env.root, 'data/cache/skeletons');
const scenarios =
  values.scenario ??
  (await readdir(scoutDir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length));

const scouts = await Promise.all(
  scenarios.map(async (s) => JSON.parse(await readFile(join(scoutDir, `${s}.json`), 'utf8')) as unknown),
);
const client = clientFromEnv({ concurrency: 8 });

let ids = scoutBodyIds(scouts);
let from = scenarios.join(', ');
if (values.random) {
  const extra = await randomBodyIds(client, Number(values.random), Number(values.seed));
  ids = [...new Set([...ids, ...extra.ids])].sort((a, b) => a - b);
  from += ` + ${extra.ids.length} random of ${extra.population} neurons`;
}
console.log(`skeletons: ${ids.length} bodies from ${from} → ${dir}`);

const t0 = performance.now();
const res = await fetchSkeletons({
  client,
  ids,
  dir,
  onProgress: (done, total) => {
    if (done % 250 === 0 || done === total) console.log(`  ${done}/${total}`);
  },
});

let bytes = 0;
for (const f of await readdir(dir)) if (f.endsWith('.swc')) bytes += (await stat(join(dir, f))).size;
const secs = ((performance.now() - t0) / 1000).toFixed(1);
console.log(
  `cached ${res.cached}, fetched ${res.fetched}, missing ${res.missing.length}, failed ${res.failed.length} ` +
    `in ${secs}s; cache ${(bytes / 2 ** 20).toFixed(1)} MB`,
);
if (res.missing.length)
  console.log(`missing: ${res.missing.slice(0, 20).join(', ')}${res.missing.length > 20 ? ', …' : ''}`);
for (const f of res.failed.slice(0, 10)) console.error(`failed ${f.bodyId}: ${f.error}`);
if (res.failed.length) process.exit(1);
