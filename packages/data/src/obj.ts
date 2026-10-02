export interface Mesh {
  /** xyz per vertex. */
  pos: Float32Array;
  /** Triangle list, 0-based. */
  index: Uint32Array;
}

/** Wavefront OBJ → triangle mesh. Only `v` and `f` are read; polygons are fan-triangulated. */
export function parseObj(text: string): Mesh {
  const pos: number[] = [];
  const index: number[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'v') {
      pos.push(Number(t[1]), Number(t[2]), Number(t[3]));
    } else if (t[0] === 'f') {
      const n = pos.length / 3;
      const refs = t.slice(1).map((r) => {
        const k = Number.parseInt(r, 10);
        const i = k < 0 ? n + k : k - 1;
        if (!(i >= 0 && i < n)) throw new Error(`obj: face index ${r} out of range (${n} vertices)`);
        return i;
      });
      for (let k = 1; k + 1 < refs.length; k++)
        index.push(refs[0] as number, refs[k] as number, refs[k + 1] as number);
    }
  }
  return { pos: Float32Array.from(pos), index: Uint32Array.from(index) };
}
