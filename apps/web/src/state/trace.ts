import { type NeuronTable, NONE16 } from '@fly/data';
import { makeAutoObservable, observableRef } from 'mobx';
import type { TracedPath } from '@/data/trace.worker';

export type TraceStatus = 'idle' | 'loading' | 'done' | 'failed';

/** Paths kept per query, and the longest path searched (hops). */
export const TRACE_K = 5;
export const TRACE_MAX_HOPS = 6;

/** Signal tracer: input type → output type, the strongest paths between them, one shown in 3D. */
export class TraceStore {
  from: string | null = null;
  to: string | null = null;
  status: TraceStatus = 'idle';
  paths: TracedPath[] = [];
  /** Index into `paths` of the path drawn in the scene. */
  active = 0;

  constructor() {
    makeAutoObservable(this, { paths: observableRef });
  }

  /** Both ends set and distinct. */
  get query(): { from: string; to: string } | null {
    const { from, to } = this;
    return from && to && from !== to ? { from, to } : null;
  }

  get path(): TracedPath | null {
    return this.status === 'done' ? (this.paths[this.active] ?? null) : null;
  }

  setEnds(from: string | null, to: string | null) {
    if (from === this.from && to === this.to) return;
    this.from = from;
    this.to = to;
    this.status = 'idle';
    this.paths = [];
    this.active = 0;
  }

  /** A clicked neuron's type: From first, then To (replacing it on later picks). */
  pick(type: string) {
    if (this.from === null) this.setEnds(type, this.to);
    else if (type !== this.from) this.setEnds(this.from, type);
  }

  swap() {
    this.setEnds(this.to, this.from);
  }

  setLoading() {
    this.status = 'loading';
  }

  setResult(paths: TracedPath[]) {
    this.paths = paths;
    this.active = 0;
    this.status = 'done';
  }

  setFailed() {
    this.paths = [];
    this.status = 'failed';
  }

  setActive(i: number) {
    this.active = i >= 0 && i < this.paths.length ? i : 0;
  }
}

/** Per scenario row: 1 + hop index of its type on the path, 0 off the path. */
export function pathHops(meta: NeuronTable, types: string[]): Uint8Array {
  const hopOf = new Map<number, number>();
  types.forEach((t, h) => {
    const code = meta.strings.types.indexOf(t);
    if (code >= 0) hopOf.set(code, h + 1);
  });
  const hops = new Uint8Array(meta.n);
  for (let i = 0; i < meta.n; i++) {
    const code = meta.type[i] as number;
    if (code !== NONE16) hops[i] = hopOf.get(code) ?? 0;
  }
  return hops;
}

export const trace = new TraceStore();
