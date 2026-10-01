import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type BBox, bboxOf, encodeCloud, lodTiers, mulberry32, parseSwc, sampleCable } from '@fly/data';

export interface BuildCloudOptions {
  /** Skeleton cache: <id>.swc per body (bodies without a file are skipped). */
  dir: string;
  ids: number[];
  /** Mean distance between sampled points along the cable, source units. */
  spacing: number;
  /** Points per LOD tier; LOD k = tiers 0..k. */
  tiers: number[];
  seed: number;
  /** Quantization box; defaults to the sampled points' bbox + pad. */
  bbox?: BBox;
  pad?: number;
}

export interface CloudBuild {
  bbox: BBox;
  bodies: number;
  /** Points sampled before tiering. */
  sampled: number;
  tiers: Float32Array[];
  /** Encoded `cloud` chunk per tier. */
  chunks: Uint8Array[];
}

export async function buildCloud(o: BuildCloudOptions): Promise<CloudBuild> {
  const rand = mulberry32(o.seed);
  const parts: Float32Array[] = [];
  for (const id of o.ids) {
    const text = await readFile(join(o.dir, `${id}.swc`), 'utf8').catch(() => null);
    if (text !== null) parts.push(sampleCable(parseSwc(text), o.spacing, rand));
  }
  const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  const bbox = o.bbox ?? bboxOf(all, o.pad ?? 0);
  const tiers = lodTiers(all, o.tiers, rand);
  return {
    bbox,
    bodies: parts.length,
    sampled: all.length / 3,
    tiers,
    chunks: tiers.map((t) => encodeCloud(t, bbox)),
  };
}
