import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mulberry32, parseSwc } from '@fly/data';
import { z } from 'zod';
import type { NeuprintClient } from '../neuprint/client';

const scoutSchema = z.object({ types: z.array(z.object({ bodyIds: z.array(z.number().int()) })) });

/** Unique, sorted bodyIds of all types in the given scout files (data/scout/*.json). */
export function scoutBodyIds(scouts: unknown[]): number[] {
  const ids = new Set<number>();
  for (const s of scouts) for (const t of scoutSchema.parse(s).types) for (const id of t.bodyIds) ids.add(id);
  return [...ids].sort((a, b) => a - b);
}

/** Deterministic sample of n unique ids (sorted); input order does not matter. */
export function pickRandom(ids: number[], n: number, seed: number): number[] {
  const pool = [...new Set(ids)].sort((a, b) => a - b);
  const rand = mulberry32(seed);
  const k = Math.min(n, pool.length);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j] as number, pool[i] as number];
  }
  return pool.slice(0, k).sort((a, b) => a - b);
}

export interface FetchSkeletonsOptions {
  client: Pick<NeuprintClient, 'skeleton'>;
  ids: number[];
  /** Cache dir: <id>.swc per body, <id>.missing when neuPrint has no skeleton. */
  dir: string;
  onProgress?: (done: number, total: number) => void;
}

export interface FetchSkeletonsResult {
  cached: number;
  fetched: number;
  missing: number[];
  failed: { bodyId: number; error: string }[];
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

/** Atomic write: a killed run never leaves a truncated cache file behind. */
async function put(path: string, data: string) {
  await writeFile(`${path}.tmp`, data);
  await rename(`${path}.tmp`, path);
}

/** Resumable: cached and known-missing bodies are skipped; failures are reported, not cached. */
export async function fetchSkeletons(opts: FetchSkeletonsOptions): Promise<FetchSkeletonsResult> {
  const { client, dir, onProgress } = opts;
  const ids = [...new Set(opts.ids)];
  const res: FetchSkeletonsResult = { cached: 0, fetched: 0, missing: [], failed: [] };
  await mkdir(dir, { recursive: true });

  let done = 0;
  await Promise.all(
    ids.map(async (bodyId) => {
      const swcPath = join(dir, `${bodyId}.swc`);
      const missingPath = join(dir, `${bodyId}.missing`);
      try {
        if (await exists(swcPath)) res.cached++;
        else if (await exists(missingPath)) res.missing.push(bodyId);
        else {
          const swc = await client.skeleton(bodyId);
          if (swc === null) {
            await put(missingPath, '');
            res.missing.push(bodyId);
          } else {
            parseSwc(swc);
            await put(swcPath, swc);
            res.fetched++;
          }
        }
      } catch (e) {
        res.failed.push({ bodyId, error: String(e) });
      }
      onProgress?.(++done, ids.length);
    }),
  );
  res.missing.sort((a, b) => a - b);
  res.failed.sort((a, b) => a.bodyId - b.bodyId);
  return res;
}
