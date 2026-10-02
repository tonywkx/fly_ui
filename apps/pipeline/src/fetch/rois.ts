import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseObj } from '@fly/data';
import type { NeuprintClient } from '../neuprint/client';
import { exists, put } from './cache';

/** Outer shells: brain + optic lobes + VNC + neck connective. */
export const SHELL_ROIS = ['CentralBrain', 'Optic(L)', 'Optic(R)', 'CV', 'VNC'];

/** Dataset's primary ROIs (neuropils + nerves), minus the `*-unspecified` remainders. */
export async function primaryRois(client: Pick<NeuprintClient, 'query'>): Promise<string[]> {
  const [row] = await client.query<{ rois: string[] }>('MATCH (m:Meta) RETURN m.primaryRois AS rois');
  return (row?.rois ?? []).filter((r) => !r.endsWith('-unspecified'));
}

/** Cache file name; ROI names carry parens and quotes. */
export const roiFile = (roi: string) => `${encodeURIComponent(roi).replaceAll("'", '%27')}.obj`;

export interface FetchRoiMeshesOptions {
  client: Pick<NeuprintClient, 'roiMesh'>;
  rois: string[];
  /** Cache dir: roiFile(name) per ROI, <same>.missing when neuPrint has no mesh. */
  dir: string;
}

export interface FetchRoiMeshesResult {
  cached: number;
  fetched: number;
  missing: string[];
  failed: { roi: string; error: string }[];
}

/** Resumable: cached and known-missing ROIs are skipped; failures are reported, not cached. */
export async function fetchRoiMeshes(opts: FetchRoiMeshesOptions): Promise<FetchRoiMeshesResult> {
  const { client, dir } = opts;
  const rois = [...new Set(opts.rois)];
  const res: FetchRoiMeshesResult = { cached: 0, fetched: 0, missing: [], failed: [] };
  await mkdir(dir, { recursive: true });

  await Promise.all(
    rois.map(async (roi) => {
      const objPath = join(dir, roiFile(roi));
      const missingPath = objPath.replace(/\.obj$/, '.missing');
      try {
        if (await exists(objPath)) res.cached++;
        else if (await exists(missingPath)) res.missing.push(roi);
        else {
          const obj = await client.roiMesh(roi);
          if (obj === null) {
            await put(missingPath, '');
            res.missing.push(roi);
          } else {
            parseObj(obj);
            await put(objPath, obj);
            res.fetched++;
          }
        }
      } catch (e) {
        res.failed.push({ roi, error: String(e) });
      }
    }),
  );
  res.missing.sort();
  res.failed.sort((a, b) => a.roi.localeCompare(b.roi));
  return res;
}
