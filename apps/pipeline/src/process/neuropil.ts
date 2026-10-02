import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Mesh, type NamedMesh, parseObj } from '@fly/data';
import { MeshoptSimplifier } from 'meshoptimizer';
import { roiFile } from '../fetch/rois';

/** Merges vertices with identical positions (seams would otherwise lock the simplifier). */
export function weld(m: Mesh): Mesh {
  const ids = new Map<string, number>();
  const pos: number[] = [];
  const remap = new Uint32Array(m.pos.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const key = `${m.pos[i * 3]},${m.pos[i * 3 + 1]},${m.pos[i * 3 + 2]}`;
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
      pos.push(m.pos[i * 3] as number, m.pos[i * 3 + 1] as number, m.pos[i * 3 + 2] as number);
    }
    remap[i] = id;
  }
  return { pos: Float32Array.from(pos), index: m.index.map((i) => remap[i] as number) };
}

/** Drops vertices no triangle references; indices follow first use. */
function compact(pos: Float32Array, index: Uint32Array): Mesh {
  const remap = new Map<number, number>();
  const out: number[] = [];
  const idx = index.map((i) => {
    let j = remap.get(i);
    if (j === undefined) {
      j = remap.size;
      remap.set(i, j);
      out.push(pos[i * 3] as number, pos[i * 3 + 1] as number, pos[i * 3 + 2] as number);
    }
    return j;
  });
  return { pos: Float32Array.from(out), index: idx };
}

/** Quadric simplification to at most `targetTris` triangles (sloppy fallback if topology blocks it). */
export async function decimate(m: Mesh, targetTris: number): Promise<Mesh> {
  if (m.index.length / 3 <= targetTris) return m;
  await MeshoptSimplifier.ready;
  let [idx] = MeshoptSimplifier.simplify(m.index, m.pos, 3, targetTris * 3, 1);
  if (idx.length > targetTris * 3)
    [idx] = MeshoptSimplifier.simplifySloppy(m.index, m.pos, 3, null, targetTris * 3, 1);
  return compact(m.pos, idx);
}

export interface BuildNeuropilsOptions {
  /** ROI mesh cache (see fetchRoiMeshes). */
  dir: string;
  rois: string[];
  targetTris: number;
}

export async function buildNeuropils(
  opts: BuildNeuropilsOptions,
): Promise<{ meshes: NamedMesh[]; skipped: string[] }> {
  const meshes: NamedMesh[] = [];
  const skipped: string[] = [];
  for (const name of opts.rois) {
    const path = join(opts.dir, roiFile(name));
    const ok = await access(path).then(
      () => true,
      () => false,
    );
    if (!ok) {
      skipped.push(name);
      continue;
    }
    const mesh = await decimate(weld(parseObj(await readFile(path, 'utf8'))), opts.targetTris);
    meshes.push({ name, ...mesh });
  }
  return { meshes, skipped };
}
