import type { TypeGraph } from '@fly/data';

/** One hop of a traced path: summed synapses and their share of the post type's input. */
export interface Hop {
  w: number;
  frac: number;
}

export interface TypePath {
  /** Type indices, source first. */
  types: number[];
  /** Product of the hops' input fractions. */
  fraction: number;
  /** Summed synapses along the path. */
  synapses: number;
  hops: Hop[];
}

/** Type graph with per-edge costs, prepared once per graph. */
export interface PreparedPaths {
  g: TypeGraph;
  totals: Float64Array;
  /** −log(input fraction) + ε per hop (ε breaks zero-cost ties toward fewer hops). */
  cost: Float64Array;
}

export interface PathOptions {
  k: number;
  maxHops: number;
  /** Types a path may pass through (non-zero = allowed); the ends are always allowed. */
  allowed?: Uint8Array;
}

const EPS = 1e-9;
const CARRIED = -2;

/** Summed incoming weight per type, self-loops excluded. */
export function inputTotals(g: TypeGraph): Float64Array {
  const totals = new Float64Array(g.names.length);
  for (let a = 0; a + 1 < g.offsets.length; a++)
    for (let e = g.offsets[a] as number; e < (g.offsets[a + 1] as number); e++) {
      const b = g.cols[e] as number;
      if (b !== a) totals[b] = (totals[b] as number) + (g.weight[e] as number);
    }
  return totals;
}

export function preparePaths(g: TypeGraph): PreparedPaths {
  const totals = inputTotals(g);
  const cost = new Float64Array(g.cols.length);
  for (let e = 0; e < cost.length; e++) {
    const t = totals[g.cols[e] as number] as number;
    cost[e] = t > 0 ? -Math.log((g.weight[e] as number) / t) + EPS : Infinity;
  }
  return { g, totals, cost };
}

interface Walk {
  nodes: number[];
  edges: number[];
  cost: number;
}

/** k strongest simple paths src → dst (Yen over a hop-bounded shortest path). */
export function kBestPaths(p: PreparedPaths, src: number, dst: number, opts: PathOptions): TypePath[] {
  const { k, maxHops, allowed } = opts;
  if (src === dst || k <= 0) return [];
  const n = p.g.names.length;
  const blocked = new Uint8Array(n);
  if (allowed) for (let i = 0; i < n; i++) blocked[i] = allowed[i] ? 0 : 1;
  blocked[src] = 0;
  blocked[dst] = 0;

  const first = shortest(p, src, dst, maxHops, blocked, new Set());
  if (!first) return [];
  const found: Walk[] = [first];
  const candidates: Walk[] = [];
  const seen = new Set([first.nodes.join()]);

  while (found.length < k) {
    const prev = found[found.length - 1] as Walk;
    for (let i = 0; i + 1 < prev.nodes.length; i++) {
      const root = prev.nodes.slice(0, i + 1);
      const removed = new Set<number>();
      for (const w of found) if (samePrefix(w.nodes, root)) removed.add(w.edges[i] as number);
      const block = blocked.slice();
      for (let j = 0; j < i; j++) block[root[j] as number] = 1;
      const spur = shortest(p, root[i] as number, dst, maxHops - i, block, removed);
      if (!spur) continue;
      const rootEdges = prev.edges.slice(0, i);
      const walk: Walk = {
        nodes: [...root.slice(0, i), ...spur.nodes],
        edges: [...rootEdges, ...spur.edges],
        cost: rootEdges.reduce((s, e) => s + (p.cost[e] as number), 0) + spur.cost,
      };
      const key = walk.nodes.join();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(walk);
    }
    if (candidates.length === 0) break;
    let best = 0;
    for (let c = 1; c < candidates.length; c++)
      if (better(candidates[c] as Walk, candidates[best] as Walk)) best = c;
    found.push(candidates.splice(best, 1)[0] as Walk);
  }
  return found.map((w) => toPath(p, w));
}

/** Cheapest walk with ≤ maxHops edges (layered Bellman–Ford from the frontier); costs > 0, so it is simple. */
function shortest(
  p: PreparedPaths,
  src: number,
  dst: number,
  maxHops: number,
  blocked: Uint8Array,
  removed: Set<number>,
): Walk | null {
  const { g, cost } = p;
  const n = g.names.length;
  let dist = new Float64Array(n).fill(Infinity);
  dist[src] = 0;
  const parents: Int32Array[] = [];
  let frontier = [src];
  for (let h = 0; h < maxHops && frontier.length > 0; h++) {
    const next = dist.slice();
    const parent = new Int32Array(n).fill(CARRIED);
    const changed: number[] = [];
    for (const u of frontier) {
      const du = dist[u] as number;
      for (let e = g.offsets[u] as number; e < (g.offsets[u + 1] as number); e++) {
        const v = g.cols[e] as number;
        if (v === u || v === src || blocked[v] || removed.has(e)) continue;
        const d = du + (cost[e] as number);
        if (d < (next[v] as number)) {
          if (parent[v] === CARRIED) changed.push(v);
          next[v] = d;
          parent[v] = e;
        }
      }
    }
    parents.push(parent);
    dist = next;
    // dst is a sink for the search: walks never continue through it
    frontier = changed.filter((v) => v !== dst);
  }
  if (!Number.isFinite(dist[dst] as number)) return null;
  const nodes = [dst];
  const edges: number[] = [];
  let v = dst;
  for (let h = parents.length - 1; h >= 0 && v !== src; h--) {
    const e = (parents[h] as Int32Array)[v] as number;
    if (e === CARRIED) continue;
    edges.push(e);
    v = owner(g, e);
    nodes.push(v);
  }
  return { nodes: nodes.reverse(), edges: edges.reverse(), cost: dist[dst] as number };
}

/** Row of edge `e` (binary search over offsets). */
function owner(g: TypeGraph, e: number): number {
  let lo = 0;
  let hi = g.offsets.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if ((g.offsets[mid] as number) <= e) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function samePrefix(nodes: number[], root: number[]): boolean {
  if (nodes.length <= root.length) return false;
  return root.every((r, j) => nodes[j] === r);
}

/** Lower cost first, then fewer hops, then lexicographic types (deterministic). */
function better(a: Walk, b: Walk): boolean {
  if (a.cost !== b.cost) return a.cost < b.cost;
  if (a.nodes.length !== b.nodes.length) return a.nodes.length < b.nodes.length;
  for (let i = 0; i < a.nodes.length; i++)
    if (a.nodes[i] !== b.nodes[i]) return (a.nodes[i] as number) < (b.nodes[i] as number);
  return false;
}

function toPath(p: PreparedPaths, w: Walk): TypePath {
  const hops = w.edges.map((e) => {
    const wt = p.g.weight[e] as number;
    return { w: wt, frac: wt / (p.totals[p.g.cols[e] as number] as number) };
  });
  return {
    types: w.nodes,
    fraction: hops.reduce((f, h) => f * h.frac, 1),
    synapses: hops.reduce((s, h) => s + h.w, 0),
    hops,
  };
}
