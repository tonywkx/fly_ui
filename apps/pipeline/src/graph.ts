import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { brotliCompressSync, gzipSync, constants as zlib } from 'node:zlib';
import { collapseByType, decodeMeta, encodeGraph, encodeMeta, encodeTypeGraph } from '@fly/data';
import { env } from './env';
import {
  allBodyIds,
  EDGE_BATCH,
  fetchBatches,
  fetchEdgeBatch,
  fetchNeuronBatch,
  loadGraphCache,
  META_BATCH,
  MIN_WEIGHT,
} from './fetch/graph';
import { primaryRois } from './fetch/rois';
import { scoutBodyIds } from './fetch/skeletons';
import { clientFromEnv } from './neuprint/fromEnv';
import { buildGraph, type Graph, orderNeurons, subgraph, toRecord } from './process/graph';

// Connectivity: full pruned CNS graph (lazy) + induced scenario subgraphs (first frame), CSR + meta.
const { values } = parseArgs({
  options: {
    'meta-batch': { type: 'string', default: String(META_BATCH) },
    'edge-batch': { type: 'string', default: String(EDGE_BATCH) },
    concurrency: { type: 'string', default: '6' },
  },
});

const cache = join(env.root, 'data/cache/graph');
const out = join(env.root, 'data/build');
const scoutDir = join(env.root, 'data/scout');
const t0 = performance.now();
const secs = () => ((performance.now() - t0) / 1000).toFixed(0);

const client = clientFromEnv({ concurrency: Number(values.concurrency) });
await mkdir(cache, { recursive: true });
const idsPath = join(cache, 'ids.json');
let ids: number[];
try {
  ids = JSON.parse(await readFile(idsPath, 'utf8')) as number[];
} catch {
  ids = await allBodyIds(client);
  await writeFile(idsPath, JSON.stringify(ids));
}
const primary = new Set(await primaryRois(client));
console.log(`graph: ${ids.length} neurons, ${primary.size} primary rois, weight >= ${MIN_WEIGHT}`);

const progress = (label: string) => (done: number, total: number) => {
  if (done % 25 === 0 || done === total) console.log(`  ${label} ${done}/${total} (${secs()}s)`);
};
const metaSize = Number(values['meta-batch']);
const edgeSize = Number(values['edge-batch']);
for (const [label, size, fetch] of [
  ['meta', metaSize, (b: number[]) => fetchNeuronBatch(client, b, primary)],
  ['edges', edgeSize, (b: number[]) => fetchEdgeBatch(client, b)],
] as const) {
  const res = await fetchBatches<unknown>({
    ids,
    size,
    dir: cache,
    prefix: label,
    fetch,
    onProgress: progress(label),
  });
  console.log(`${label}: cached ${res.cached}, fetched ${res.fetched}, failed ${res.failed.length}`);
  for (const f of res.failed.slice(0, 5)) console.error(`  failed batch ${f.batch}: ${f.error}`);
  if (res.failed.length) process.exit(1);
}

const { neurons, edges } = await loadGraphCache(cache, { meta: metaSize, edges: edgeSize });
const meta = orderNeurons(neurons.map(toRecord));
const full = buildGraph(meta, edges);
console.log(
  `built: ${meta.length} neurons, ${full.csr.cols.length} edges, dropped ${full.dropped} (${secs()}s)`,
);

const mb = (n: number) => `${(n / 2 ** 20).toFixed(2)} MB`;
const report = (bytes: Uint8Array) => {
  const br = brotliCompressSync(bytes, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9 } }).byteLength;
  return `${mb(bytes.byteLength)} raw, ${mb(gzipSync(bytes, { level: 9 }).byteLength)} gz, ${mb(br)} br`;
};
const write = async (name: string, g: Graph) => {
  const graph = encodeGraph(g.csr);
  const metaBytes = encodeMeta(g.meta);
  await writeFile(join(out, `graph-${name}.bin`), graph);
  await writeFile(join(out, `meta-${name}.bin`), metaBytes);
  const signs = [0, 0, 0];
  for (const r of g.meta) signs[r.sign + 1] = (signs[r.sign + 1] as number) + 1;
  console.log(
    `  ${name}: ${g.meta.length} neurons (− ${signs[0]} / 0 ${signs[1]} / + ${signs[2]}), ${g.csr.cols.length} edges`,
  );
  console.log(`    graph ${report(graph)}; meta ${report(metaBytes)}`);
  return metaBytes;
};

await mkdir(out, { recursive: true });
const types = collapseByType(full.csr, decodeMeta(await write('full', full)));
const typeBytes = encodeTypeGraph(types);
await writeFile(join(out, 'typegraph-full.bin'), typeBytes);
console.log(`  typegraph: ${types.names.length} types, ${types.cols.length} edges; ${report(typeBytes)}`);
for (const f of (await readdir(scoutDir)).filter((f) => f.endsWith('.json')).sort()) {
  const scout = JSON.parse(await readFile(join(scoutDir, f), 'utf8')) as unknown;
  await write(f.slice(0, -'.json'.length), subgraph(full, scoutBodyIds([scout])));
}
console.log(`done in ${secs()}s`);
