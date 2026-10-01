import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { env } from './env';
import { randomBodyIds } from './fetch/skeletons';
import { clientFromEnv } from './neuprint/fromEnv';
import { buildCloud } from './process/cloud';

// Background CNS cloud from the random body sample fetched by `pnpm pull --random=N` (same N + seed).
const { values } = parseArgs({
  options: {
    random: { type: 'string', default: '5000' },
    seed: { type: 'string', default: '1' },
    spacing: { type: 'string', default: '2000' },
    tiers: { type: 'string', default: '200000,600000,1200000' },
  },
});

const dir = join(env.root, 'data/cache/skeletons');
const out = join(env.root, 'data/build');
const tiers = values.tiers.split(',').map(Number);

const t0 = performance.now();
const { ids, population } = await randomBodyIds(clientFromEnv(), Number(values.random), Number(values.seed));
console.log(`cloud: ${ids.length} random of ${population} neurons, spacing ${values.spacing}`);

const res = await buildCloud({ dir, ids, spacing: Number(values.spacing), tiers, seed: Number(values.seed) });
await mkdir(out, { recursive: true });
for (const [k, chunk] of res.chunks.entries()) {
  await writeFile(join(out, `cloud-lod${k}.bin`), chunk);
  const n = (res.tiers[k] as Float32Array).length / 3;
  console.log(`  lod${k}: ${n} points, ${(chunk.byteLength / 2 ** 20).toFixed(2)} MB`);
}
const fmt = (v: number[]) => v.map((x) => Math.round(x)).join(', ');
console.log(
  `bodies ${res.bodies}/${ids.length}, sampled ${res.sampled} points, ` +
    `bbox [${fmt(res.bbox.min)}] – [${fmt(res.bbox.max)}] in ${((performance.now() - t0) / 1000).toFixed(1)}s`,
);
if (res.sampled < tiers.reduce((a, b) => a + b, 0))
  console.warn('warn: fewer points than tiers ask for; lower --spacing');
