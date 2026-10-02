import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { bboxOf, encodeNeuropils, type NamedMesh } from '@fly/data';
import { env } from './env';
import { fetchRoiMeshes, primaryRois, SHELL_ROIS } from './fetch/rois';
import { clientFromEnv } from './neuprint/fromEnv';
import { buildNeuropils } from './process/neuropil';

// Neuropil meshes: shells (first frame) + primary ROIs (lazy), one shared bbox from the shells.
const { values } = parseArgs({
  options: {
    'shell-tris': { type: 'string', default: '15000' },
    'region-tris': { type: 'string', default: '2000' },
  },
});

const dir = join(env.root, 'data/cache/rois');
const out = join(env.root, 'data/build');
const t0 = performance.now();

const client = clientFromEnv();
const regions = await primaryRois(client);
const fetched = await fetchRoiMeshes({ client, rois: [...SHELL_ROIS, ...regions], dir });
console.log(
  `rois: ${SHELL_ROIS.length} shells + ${regions.length} regions; cached ${fetched.cached}, fetched ${fetched.fetched}, ` +
    `missing [${fetched.missing.join(', ')}]`,
);
for (const f of fetched.failed) console.warn(`  failed ${f.roi}: ${f.error}`);

const shells = await buildNeuropils({ dir, rois: SHELL_ROIS, targetTris: Number(values['shell-tris']) });
const parts = await buildNeuropils({ dir, rois: regions, targetTris: Number(values['region-tris']) });

const concat = (ms: NamedMesh[]) => Float32Array.from(ms.flatMap((m) => Array.from(m.pos)));
const bbox = bboxOf(concat(shells.meshes), 100);
const outside = parts.meshes.filter((m) => {
  const b = bboxOf(m.pos, 0);
  return (
    b.min.some((v, k) => v < (bbox.min[k] as number)) || b.max.some((v, k) => v > (bbox.max[k] as number))
  );
});
if (outside.length)
  console.warn(`warn: regions outside the shell bbox (clamped): ${outside.map((m) => m.name).join(', ')}`);

await mkdir(out, { recursive: true });
for (const [name, set] of [
  ['shells', shells],
  ['regions', parts],
] as const) {
  const chunk = encodeNeuropils(set.meshes, bbox);
  await writeFile(join(out, `neuropil-${name}.bin`), chunk);
  const tris = set.meshes.reduce((s, m) => s + m.index.length / 3, 0);
  const verts = set.meshes.reduce((s, m) => s + m.pos.length / 3, 0);
  console.log(
    `  ${name}: ${set.meshes.length} meshes, ${verts} verts, ${tris} tris, ${(chunk.byteLength / 2 ** 20).toFixed(2)} MB` +
      (set.skipped.length ? `, skipped [${set.skipped.join(', ')}]` : ''),
  );
}
const fmt = (v: number[]) => v.map((x) => Math.round(x)).join(', ');
console.log(
  `bbox [${fmt(bbox.min)}] – [${fmt(bbox.max)}] in ${((performance.now() - t0) / 1000).toFixed(1)}s`,
);
