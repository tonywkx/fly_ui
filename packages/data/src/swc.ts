/** Neuron skeleton in topological order: parent[i] < i, soma is node 0 and a root. */
export interface Skeleton {
  pos: Float32Array; // n*3, source units (nm in neuPrint)
  radius: Float32Array;
  parent: Int32Array; // -1 = root
  type: Uint8Array; // SWC structure type
  soma: number;
}

export class SwcError extends Error {
  override name = 'SwcError';
}

const SOMA_TYPE = 1;

/** Parses SWC text; reroots the soma component at the soma (type=1, else max radius). */
export function parseSwc(text: string): Skeleton {
  const ids: number[] = [];
  const types: number[] = [];
  const xyz: number[] = [];
  const radii: number[] = [];
  const pids: number[] = [];

  const lines = text.split(/\r?\n/);
  for (let ln = 0; ln < lines.length; ln++) {
    const line = (lines[ln] ?? '').trim();
    if (line === '' || line.startsWith('#')) continue;
    const f = line.split(/\s+/).map(Number);
    if (f.length < 7 || f.some((v) => !Number.isFinite(v))) {
      throw new SwcError(`line ${ln + 1}: expected 7 numeric columns`);
    }
    const [id, type, x, y, z, r, pid] = f as [number, number, number, number, number, number, number];
    ids.push(id);
    types.push(type);
    xyz.push(x, y, z);
    radii.push(r);
    pids.push(pid);
  }
  const n = ids.length;
  if (n === 0) throw new SwcError('no nodes');

  const index = new Map<number, number>();
  ids.forEach((id, i) => {
    if (index.has(id)) throw new SwcError(`duplicate id ${id}`);
    index.set(id, i);
  });
  const up = pids.map((pid, i) => {
    if (pid < 0) return -1;
    const p = index.get(pid);
    if (p === undefined) throw new SwcError(`node ${ids[i]}: missing parent ${pid}`);
    return p;
  });
  assertAcyclic(up, ids);

  // undirected adjacency (CSR) so the soma component can be traversed from the soma
  const src: number[] = [];
  const dst: number[] = [];
  up.forEach((p, i) => {
    if (p < 0) return;
    src.push(i, p);
    dst.push(p, i);
  });
  const { offsets: deg, targets: adj } = csr(n, src, dst);

  // BFS: soma first, then remaining roots in file order
  const soma = pickSoma(types, radii);
  const order = new Int32Array(n);
  const newIdx = new Int32Array(n).fill(-1);
  const parent = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const seeds = [soma, ...up.flatMap((p, i) => (p < 0 ? [i] : []))];
  for (const s of seeds) {
    if (newIdx[s] !== -1) continue;
    newIdx[s] = tail;
    parent[tail] = -1;
    order[tail++] = s;
    while (head < tail) {
      const u = order[head++] as number;
      for (let k = deg[u] as number; k < (deg[u + 1] as number); k++) {
        const v = adj[k] as number;
        if (newIdx[v] !== -1) continue;
        newIdx[v] = tail;
        parent[tail] = newIdx[u] as number;
        order[tail++] = v;
      }
    }
  }

  const pos = new Float32Array(n * 3);
  const radius = new Float32Array(n);
  const type = new Uint8Array(n);
  for (let j = 0; j < n; j++) {
    const i = order[j] as number;
    pos[j * 3] = xyz[i * 3] as number;
    pos[j * 3 + 1] = xyz[i * 3 + 1] as number;
    pos[j * 3 + 2] = xyz[i * 3 + 2] as number;
    radius[j] = radii[i] as number;
    type[j] = types[i] as number;
  }
  return { pos, radius, parent, type, soma: 0 };
}

/** Child lists as CSR: children of i are children[offsets[i]..offsets[i+1]). */
export function childrenOf(sk: Skeleton): { offsets: Uint32Array; children: Uint32Array } {
  const src: number[] = [];
  const dst: number[] = [];
  sk.parent.forEach((p, i) => {
    if (p < 0) return;
    src.push(p);
    dst.push(i);
  });
  const { offsets, targets: children } = csr(sk.parent.length, src, dst);
  return { offsets, children };
}

/** Edge list -> CSR; targets keep edge insertion order per source. */
function csr(n: number, src: number[], dst: number[]): { offsets: Uint32Array; targets: Uint32Array } {
  const offsets = new Uint32Array(n + 1);
  for (const u of src) offsets[u + 1] = (offsets[u + 1] as number) + 1;
  for (let i = 0; i < n; i++) offsets[i + 1] = (offsets[i + 1] as number) + (offsets[i] as number);
  const fill = offsets.slice(0, n);
  const targets = new Uint32Array(src.length);
  src.forEach((u, k) => {
    const at = fill[u] as number;
    targets[at] = dst[k] as number;
    fill[u] = at + 1;
  });
  return { offsets, targets };
}

function pickSoma(types: number[], radii: number[]): number {
  const typed = types.some((t) => t === SOMA_TYPE);
  let best = -1;
  for (let i = 0; i < radii.length; i++) {
    if (typed && types[i] !== SOMA_TYPE) continue;
    if (best < 0 || (radii[i] as number) > (radii[best] as number)) best = i;
  }
  return best;
}

function assertAcyclic(up: number[], ids: number[]): void {
  const state = new Uint8Array(up.length); // 0 new, 1 on current path, 2 done
  for (let i = 0; i < up.length; i++) {
    let u = i;
    while (u >= 0 && state[u] === 0) {
      state[u] = 1;
      u = up[u] as number;
    }
    if (u >= 0 && state[u] === 1) throw new SwcError(`cycle through node ${ids[u]}`);
    for (let v = i; v >= 0 && state[v] === 1; v = up[v] as number) state[v] = 2;
  }
}
