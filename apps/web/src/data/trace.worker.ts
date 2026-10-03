import { decodeTypeGraph } from '@fly/data';
import { expose } from 'comlink';
import { type Hop, kBestPaths, type PreparedPaths, preparePaths } from './paths';

/** A traced path by type name (what crosses the Worker boundary). */
export interface TracedPath {
  types: string[];
  fraction: number;
  synapses: number;
  hops: Hop[];
}

export interface TraceQuery {
  from: string;
  to: string;
  /** Types a path may pass through (the scenario's); the ends are always allowed. */
  via: string[];
  k: number;
  maxHops: number;
}

let loading: Promise<{ p: PreparedPaths; index: Map<string, number> }> | undefined;

async function load(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const p = preparePaths(decodeTypeGraph(await res.arrayBuffer()));
  return { p, index: new Map(p.g.names.map((n, i) => [n, i])) };
}

const api = {
  /** k strongest paths over `typegraph-full` (fetched once, here); unknown types → none. */
  async trace(url: string, q: TraceQuery): Promise<TracedPath[]> {
    loading ??= load(url).catch((e) => {
      loading = undefined;
      throw e;
    });
    const { p, index } = await loading;
    const src = index.get(q.from);
    const dst = index.get(q.to);
    if (src === undefined || dst === undefined) return [];
    const allowed = new Uint8Array(p.g.names.length);
    for (const name of q.via) {
      const i = index.get(name);
      if (i !== undefined) allowed[i] = 1;
    }
    return kBestPaths(p, src, dst, { k: q.k, maxHops: q.maxHops, allowed }).map((r) => ({
      ...r,
      types: r.types.map((t) => p.g.names[t] as string),
    }));
  },
};

export type TraceApi = typeof api;
expose(api);
