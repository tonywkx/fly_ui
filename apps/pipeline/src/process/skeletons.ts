import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type BBox, bboxOf, parseSwc, type Skeleton, simplify } from '@fly/data';

export interface BuildSkeletonsOptions {
  /** Skeleton cache: <id>.swc per body (bodies without a file are reported as missing). */
  dir: string;
  ids: number[];
  /** RDP tolerance, source units. */
  epsilon: number;
}

export interface SkeletonBuild {
  items: { bodyId: number; skeleton: Skeleton }[];
  missing: number[];
  /** Nodes before / after simplification. */
  nodes: { before: number; after: number };
  /** Unpadded bbox of the kept nodes; null when nothing was built. */
  bbox: BBox | null;
}

export async function buildSkeletons(o: BuildSkeletonsOptions): Promise<SkeletonBuild> {
  const res: SkeletonBuild = { items: [], missing: [], nodes: { before: 0, after: 0 }, bbox: null };
  for (const bodyId of o.ids) {
    const text = await readFile(join(o.dir, `${bodyId}.swc`), 'utf8').catch(() => null);
    if (text === null) {
      res.missing.push(bodyId);
      continue;
    }
    const raw = parseSwc(text);
    const skeleton = simplify(raw, o.epsilon);
    res.nodes.before += raw.parent.length;
    res.nodes.after += skeleton.parent.length;
    res.items.push({ bodyId, skeleton });
  }
  if (res.items.length) {
    const all = new Float32Array(res.nodes.after * 3);
    let at = 0;
    for (const { skeleton } of res.items) {
      all.set(skeleton.pos, at);
      at += skeleton.pos.length;
    }
    res.bbox = bboxOf(all, 0);
  }
  return res;
}
