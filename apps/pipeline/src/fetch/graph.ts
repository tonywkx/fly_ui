import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NeuprintClient } from '../neuprint/client';
import { cypher } from '../neuprint/cypher';
import { exists, put } from './cache';

/** Per neuron-pair synapse threshold for the CSR (DECISIONS.md, PLAN 1.7). */
export const MIN_WEIGHT = 5;

/** Cache batch sizes; batch files are indexed by position in ids.json, so these must not drift. */
export const META_BATCH = 2000;
export const EDGE_BATCH = 500;

/** Neuron properties as fetched; `region` is already resolved from roiInfo. */
export interface RawNeuron {
  bodyId: number;
  type: string | null;
  class: string | null;
  superclass: string | null;
  nt: string | null;
  ntConf: number | null;
  somaSide: string | null;
  fruDsx: string | null;
  region: string | null;
}

/** Columnar edge batch: pre/post bodyIds and synapse counts. */
export interface EdgeBatch {
  pre: number[];
  post: number[];
  w: number[];
}

type Query = Pick<NeuprintClient, 'query'>;

export async function allBodyIds(client: Query): Promise<number[]> {
  const rows = await client.query<{ id: number }>('MATCH (n:Neuron) RETURN n.bodyId AS id');
  return rows.map((r) => r.id).sort((a, b) => a - b);
}

/** Primary ROI with the most pre+post synapses, or null. */
export function regionOf(roiInfo: string | null, primary: ReadonlySet<string>): string | null {
  if (!roiInfo) return null;
  let best: string | null = null;
  let max = 0;
  for (const [roi, v] of Object.entries(
    JSON.parse(roiInfo) as Record<string, { pre?: number; post?: number }>,
  )) {
    const count = (v.pre ?? 0) + (v.post ?? 0);
    if (primary.has(roi) && count > max) {
      best = roi;
      max = count;
    }
  }
  return best;
}

export async function fetchNeuronBatch(
  client: Query,
  ids: number[],
  primary: ReadonlySet<string>,
): Promise<RawNeuron[]> {
  const rows = await client.query<Omit<RawNeuron, 'region'> & { roiInfo: string | null }>(
    cypher`MATCH (n:Neuron) WHERE n.bodyId IN ${ids} ` +
      'RETURN n.bodyId AS bodyId, n.type AS type, n.class AS class, n.superclass AS superclass, ' +
      'n.consensusNt AS nt, coalesce(n.celltypePredictedNtConfidence, n.predictedNtConfidence) AS ntConf, ' +
      'n.somaSide AS somaSide, n.fruDsx AS fruDsx, n.roiInfo AS roiInfo',
  );
  return rows.map(({ roiInfo, ...r }) => ({ ...r, region: regionOf(roiInfo, primary) }));
}

export async function fetchEdgeBatch(
  client: Query,
  ids: number[],
  minWeight = MIN_WEIGHT,
): Promise<EdgeBatch> {
  const rows = await client.query<{ a: number; b: number; w: number }>(
    cypher`MATCH (x:Neuron)-[c:ConnectsTo]->(y:Neuron) WHERE x.bodyId IN ${ids} AND c.weight >= ${minWeight} ` +
      'RETURN x.bodyId AS a, y.bodyId AS b, c.weight AS w',
  );
  return { pre: rows.map((r) => r.a), post: rows.map((r) => r.b), w: rows.map((r) => r.w) };
}

export interface FetchBatchesOptions<T> {
  ids: number[];
  size: number;
  /** Cache dir: `{prefix}-{i}.json` per batch of `size` consecutive ids. */
  dir: string;
  prefix: string;
  fetch: (ids: number[]) => Promise<T>;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Resumable batched fetch; batch i always covers ids[i*size, (i+1)*size), so keep `ids` stable
 * (sorted) between runs. Failures are reported, not cached.
 */
export async function fetchBatches<T>(opts: FetchBatchesOptions<T>) {
  const { ids, size, dir, prefix, fetch, onProgress } = opts;
  await mkdir(dir, { recursive: true });
  const total = Math.ceil(ids.length / size);
  const res = { cached: 0, fetched: 0, failed: [] as { batch: number; error: string }[] };
  let done = 0;
  await Promise.all(
    Array.from({ length: total }, async (_, i) => {
      const path = join(dir, `${prefix}-${i}.json`);
      try {
        if (await exists(path)) res.cached++;
        else {
          await put(path, JSON.stringify(await fetch(ids.slice(i * size, (i + 1) * size))));
          res.fetched++;
        }
      } catch (e) {
        res.failed.push({ batch: i, error: String(e) });
      }
      onProgress?.(++done, total);
    }),
  );
  return res;
}

export async function loadBatches<T>(dir: string, prefix: string, count: number): Promise<T[]> {
  return Promise.all(
    Array.from(
      { length: count },
      async (_, i) => JSON.parse(await readFile(join(dir, `${prefix}-${i}.json`), 'utf8')) as T,
    ),
  );
}

/** Cached graph fetch: all body ids, raw neurons, edge batches (see `pnpm graph`). */
export async function loadGraphCache(dir: string, sizes = { meta: META_BATCH, edges: EDGE_BATCH }) {
  const ids = JSON.parse(await readFile(join(dir, 'ids.json'), 'utf8')) as number[];
  const count = (size: number) => Math.ceil(ids.length / size);
  const neurons = (await loadBatches<RawNeuron[]>(dir, 'meta', count(sizes.meta))).flat();
  const edges = await loadBatches<EdgeBatch>(dir, 'edges', count(sizes.edges));
  return { ids, neurons, edges };
}
