export interface TypeEdge {
  from: string;
  to: string;
  /** Summed synapse count between the two types (absolute value). */
  weight: number;
}

export interface Path {
  nodes: string[];
  weights: number[];
  /** Σ 1/weight — lower is stronger. */
  cost: number;
  /** Weakest edge on the path. */
  bottleneck: number;
}

export interface PathOptions {
  k: number;
  maxHops: number;
  /** Strongest outgoing edges kept per node; bounds the search on dense graphs. */
  fanout?: number;
}

/**
 * Best-first enumeration of the k cheapest simple paths (cost = Σ 1/weight).
 * Costs are positive, so paths pop off the queue in cost order. A path stops at the first target it reaches.
 */
export function kStrongestPaths(
  edges: readonly TypeEdge[],
  sources: readonly string[],
  targets: readonly string[],
  { k, maxHops, fanout = 25 }: PathOptions,
): Path[] {
  const out = new Map<string, TypeEdge[]>();
  for (const e of edges) {
    if (e.weight <= 0 || e.from === e.to) continue;
    const list = out.get(e.from) ?? [];
    list.push(e);
    out.set(e.from, list);
  }
  for (const [node, list] of out) out.set(node, list.sort((a, b) => b.weight - a.weight).slice(0, fanout));

  const targetSet = new Set(targets);
  const queue = new MinHeap<Path>((p) => p.cost);
  for (const s of new Set(sources)) queue.push({ nodes: [s], weights: [], cost: 0, bottleneck: Infinity });

  const found: Path[] = [];
  while (queue.size > 0 && found.length < k) {
    const path = queue.pop() as Path;
    const last = path.nodes[path.nodes.length - 1] as string;
    if (path.weights.length > 0 && targetSet.has(last)) {
      found.push(path);
      continue;
    }
    if (path.weights.length >= maxHops) continue;
    for (const e of out.get(last) ?? []) {
      if (path.nodes.includes(e.to)) continue;
      queue.push({
        nodes: [...path.nodes, e.to],
        weights: [...path.weights, e.weight],
        cost: path.cost + 1 / e.weight,
        bottleneck: Math.min(path.bottleneck, e.weight),
      });
    }
  }
  return found;
}

class MinHeap<T> {
  private items: T[] = [];
  constructor(private readonly key: (item: T) => number) {}

  get size() {
    return this.items.length;
  }

  push(item: T) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.key(a[parent] as T) <= this.key(a[i] as T)) break;
      [a[parent], a[i]] = [a[i] as T, a[parent] as T];
      i = parent;
    }
  }

  pop(): T | undefined {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0 && last !== undefined) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let min = i;
        if (l < a.length && this.key(a[l] as T) < this.key(a[min] as T)) min = l;
        if (r < a.length && this.key(a[r] as T) < this.key(a[min] as T)) min = r;
        if (min === i) break;
        [a[min], a[i]] = [a[i] as T, a[min] as T];
        i = min;
      }
    }
    return top;
  }
}
