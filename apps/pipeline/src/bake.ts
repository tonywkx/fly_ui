import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { brotliCompressSync, gzipSync, constants as zlib } from 'node:zlib';
import {
  type BBox,
  bboxOf,
  bboxUnion,
  type ChunkTier,
  collapseByType,
  decodeMeta,
  encodeCloud,
  encodeGraph,
  encodeMeta,
  encodeNeuropils,
  encodeSkeletons,
  encodeSpikes,
  encodeTypeGraph,
  type NamedMesh,
  pruneTypeGraph,
} from '@fly/data';
import { env } from './env';
import { loadGraphCache } from './fetch/graph';
import { SHELL_ROIS } from './fetch/rois';
import { pickRandom, scoutBodyIds } from './fetch/skeletons';
import { type BakedChunk, BudgetError, buildManifest, checkBudget, FIRST_FRAME_BUDGET } from './process/bake';
import { buildCloud } from './process/cloud';
import { buildGraph, orderNeurons, subgraph, toRecord } from './process/graph';
import { buildNeuropils } from './process/neuropil';
import { SCENARIO_RUNS } from './process/scenarios';
import { buildSkeletons } from './process/skeletons';
import { buildNet, runScenario, scenarioRows, typeRates } from './process/spikes';

// Offline: assembles apps/web/public/data from data/cache + data/scout (run pull/cloud/neuropil/graph first).
const { values } = parseArgs({
  options: {
    random: { type: 'string', default: '5000' },
    seed: { type: 'string', default: '1' },
    spacing: { type: 'string', default: '300' },
    tiers: { type: 'string', default: '200000,600000,1200000' },
    'shell-tris': { type: 'string', default: '15000' },
    'region-tris': { type: 'string', default: '2000' },
    epsilon: { type: 'string', default: '125' },
    /** Only this scenario's skeletons are first-frame; it is listed first in the manifest. */
    default: { type: 'string', default: 'escape' },
    'type-min-weight': { type: 'string', default: '10' },
  },
});

const TITLES: Record<string, string> = {
  escape: 'Escape: giant fiber takeoff',
  sugar: 'Sugar: taste to proboscis extension',
  song: 'Courtship song',
};
const ATTRIBUTION = 'Janelia FlyEM MaleCNS v1.0 (neuPrint), CC-BY 4.0';
const UNIT_NM = 8;
const PAD = 100;

const cache = join(env.root, 'data/cache');
const scoutDir = join(env.root, 'data/scout');
const out = join(env.root, 'apps/web/public/data');
const t0 = performance.now();
const secs = () => ((performance.now() - t0) / 1000).toFixed(0);

// Graph cache: full CNS graph + all body ids (also the population for the cloud's random sample).
const g = await loadGraphCache(join(cache, 'graph'));
const full = buildGraph(orderNeurons(g.neurons.map(toRecord)), g.edges);
const fullMeta = encodeMeta(full.meta);
const types = pruneTypeGraph(
  collapseByType(full.csr, decodeMeta(fullMeta)),
  Number(values['type-min-weight']),
);
console.log(
  `graph: ${full.meta.length} neurons, ${full.csr.cols.length} edges, ${types.cols.length} type edges (${secs()}s)`,
);

const cloud = await buildCloud({
  dir: join(cache, 'skeletons'),
  ids: pickRandom(g.ids, Number(values.random), Number(values.seed)),
  spacing: Number(values.spacing),
  tiers: values.tiers.split(',').map(Number),
  seed: Number(values.seed),
});
console.log(`cloud: ${cloud.bodies} bodies, ${cloud.sampled} points (${secs()}s)`);

const roiDir = join(cache, 'rois');
const regions = (await readdir(roiDir))
  .filter((f) => f.endsWith('.obj'))
  .map((f) => decodeURIComponent(f.slice(0, -'.obj'.length)))
  .filter((r) => !SHELL_ROIS.includes(r))
  .sort();
const shells = await buildNeuropils({
  dir: roiDir,
  rois: SHELL_ROIS,
  targetTris: Number(values['shell-tris']),
});
const parts = await buildNeuropils({ dir: roiDir, rois: regions, targetTris: Number(values['region-tris']) });
const meshBox = (ms: NamedMesh[]) =>
  bboxUnion(
    ms.map((m) => bboxOf(m.pos, 0)),
    0,
  );
console.log(`neuropils: ${shells.meshes.length} shells, ${parts.meshes.length} regions (${secs()}s)`);

// Full-graph sim per scenario (Shiu LIF + literature overrides) → baked spike trains in scenario rows.
const net = buildNet(full);
const scenarios = [];
for (const f of (await readdir(scoutDir)).filter((f) => f.endsWith('.json')).sort()) {
  const id = f.slice(0, -'.json'.length);
  const ids = scoutBodyIds([JSON.parse(await readFile(join(scoutDir, f), 'utf8')) as unknown]);
  const skel = await buildSkeletons({ dir: join(cache, 'skeletons'), ids, epsilon: Number(values.epsilon) });
  if (skel.missing.length) console.warn(`  ${id}: ${skel.missing.length} skeletons missing (run pnpm pull)`);
  const graph = subgraph(full, ids);
  console.log(`  ${id}: ${ids.length} bodies, nodes ${skel.nodes.before} → ${skel.nodes.after}`);
  const run = SCENARIO_RUNS[id];
  if (!run) throw new Error(`no SCENARIO_RUNS entry for ${id}`);
  const { train, stats } = runScenario(net, full.meta, scenarioRows(full.meta, graph.meta), run);
  const rates = [...typeRates(train, graph.meta, run.anchors)].map(([t, hz]) => `${t} ${hz.toFixed(1)}`);
  console.log(
    `    sim ${run.durationMs} ms: ${stats.spikes} spikes (${train.ids.length} in scenario), ` +
      `peak active ${stats.peakActive}, ${(stats.wallMs / 1000).toFixed(1)}s; Hz: ${rates.join(', ')}`,
  );
  scenarios.push({ id, title: TITLES[id] ?? id, graph, skel, spikes: encodeSpikes(train) });
}

if (!scenarios.some((s) => s.id === values.default))
  throw new Error(`no scout file for --default=${values.default}`);
scenarios.sort((a, b) => Number(b.id === values.default) - Number(a.id === values.default));

const boxes: BBox[] = [meshBox(shells.meshes), meshBox(parts.meshes), cloud.bbox];
for (const s of scenarios) if (s.skel.bbox) boxes.push(s.skel.bbox);
const bbox = bboxUnion(boxes, PAD);

const ff: ChunkTier = 'first-frame';
const chunks: BakedChunk[] = [
  { id: 'neuropil-shells', kind: 'neuropil', tier: ff, data: encodeNeuropils(shells.meshes, bbox) },
  ...cloud.tiers.map(
    (t, lod): BakedChunk => ({
      id: `cloud-lod${lod}`,
      kind: 'cloud',
      tier: lod === 0 ? ff : 'lazy',
      lod,
      data: encodeCloud(t, bbox),
    }),
  ),
  ...scenarios.flatMap(({ id, graph, skel, spikes }): BakedChunk[] => [
    {
      id: `${id}-skeletons`,
      kind: 'skeletons',
      tier: id === values.default ? ff : 'lazy',
      scenario: id,
      data: encodeSkeletons(skel.items, bbox),
    },
    { id: `${id}-graph`, kind: 'graph', tier: ff, scenario: id, data: encodeGraph(graph.csr) },
    { id: `${id}-meta`, kind: 'meta', tier: ff, scenario: id, data: encodeMeta(graph.meta) },
    { id: `${id}-spikes`, kind: 'spikes', tier: ff, scenario: id, data: spikes },
  ]),
  { id: 'neuropil-regions', kind: 'neuropil', tier: 'lazy', data: encodeNeuropils(parts.meshes, bbox) },
  { id: 'graph-full', kind: 'graph', tier: 'lazy', data: encodeGraph(full.csr) },
  { id: 'meta-full', kind: 'meta', tier: 'lazy', data: fullMeta },
  { id: 'typegraph-full', kind: 'typegraph', tier: 'lazy', data: encodeTypeGraph(types) },
];

const manifest = buildManifest({
  dataset: env.neuprintDataset,
  attribution: ATTRIBUTION,
  unitNm: UNIT_NM,
  bbox,
  builtAt: new Date(),
  chunks,
  scenarios: scenarios.map(({ id, title }) => ({ id, title })),
});

const mb = (n: number) => (n / 2 ** 20).toFixed(2).padStart(7);
const sum = { 'first-frame': [0, 0, 0], lazy: [0, 0, 0] };
console.log(`\n${'chunk'.padEnd(20)} ${'tier'.padEnd(11)}     raw      gz      br  (MB)`);
for (const c of chunks) {
  const sizes = [
    c.data.byteLength,
    gzipSync(c.data, { level: 9 }).byteLength,
    brotliCompressSync(c.data, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9 } }).byteLength,
  ];
  sizes.forEach((v, k) => {
    sum[c.tier][k] = (sum[c.tier][k] as number) + v;
  });
  console.log(`${c.id.padEnd(20)} ${c.tier.padEnd(11)} ${sizes.map(mb).join(' ')}`);
}
for (const [tier, s] of Object.entries(sum))
  console.log(`${'Σ'.padEnd(20)} ${tier.padEnd(11)} ${s.map(mb).join(' ')}`);

try {
  const bytes = checkBudget(manifest);
  console.log(`first-frame ${mb(bytes).trim()} / ${mb(FIRST_FRAME_BUDGET).trim()} MB raw`);
} catch (e) {
  if (!(e instanceof BudgetError)) throw e;
  console.error(`FAIL: ${e.message}`);
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const c of chunks) await writeFile(join(out, `${c.id}.bin`), c.data);
await writeFile(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const fmt = (v: number[]) => v.map((x) => Math.round(x)).join(', ');
console.log(`bbox [${fmt(bbox.min)}] – [${fmt(bbox.max)}] × ${UNIT_NM} nm → ${out} in ${secs()}s`);
