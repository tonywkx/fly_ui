import { type ChunkEntry, type Manifest, parseManifest } from '@fly/data';
import { type Remote, wrap } from 'comlink';
import { makeAutoObservable, observable, observableRef, runInAction } from 'mobx';
import type { Decoded } from './decode';
import type { DecodeApi } from './decode.worker';
import { firstFrameChunks } from './plan';

type Payloads = { [D in Decoded as D['kind']]: D['data'] };

/** Manifest + decoded chunks. Payloads live in a plain Map (never observable); `loaded` signals arrival. */
export class DataStore {
  manifest: Manifest | null = null;
  scenario: string | null = null;
  loadedBytes = 0;
  totalBytes = 0;
  error: string | null = null;
  /** First-frame chunks are all decoded. */
  ready = false;
  readonly loaded = observable.set<string>();
  private readonly payloads = new Map<string, Decoded>();
  private workers: Remote<DecodeApi>[] = [];
  private next = 0;
  private baseUrl: URL;

  constructor(base = new URL('data/', document.baseURI)) {
    this.baseUrl = base;
    makeAutoObservable<this, 'payloads' | 'workers' | 'next' | 'baseUrl'>(this, {
      // Plain object: its bbox is posted to Workers, a MobX proxy would not clone.
      manifest: observableRef,
      loaded: false,
      payloads: false,
      workers: false,
      next: false,
      baseUrl: false,
    });
  }

  get<K extends keyof Payloads>(id: string, kind: K): Payloads[K] | undefined {
    const d = this.payloads.get(id);
    return d?.kind === kind ? (d.data as Payloads[K]) : undefined;
  }

  /** Fetches the manifest, then every first-frame chunk in parallel across a small Worker pool. */
  async loadFirstFrame(scenario: string | undefined): Promise<void> {
    try {
      const res = await fetch(new URL('manifest.json', this.baseUrl));
      if (!res.ok) throw new Error(`manifest.json: HTTP ${res.status}`);
      const manifest = parseManifest(await res.json());
      const plan = firstFrameChunks(manifest, scenario);
      if (plan.warning) console.warn(`[data] ${plan.warning}`);
      runInAction(() => {
        this.manifest = manifest;
        this.scenario = plan.scenario;
        this.totalBytes = plan.chunks.reduce((s, c) => s + c.bytes, 0);
      });
      // Dust + shells first (the intro assembles them while the rest streams in), then largest
      // first so the pool stays balanced.
      const early = (c: ChunkEntry) => (c.kind === 'cloud' || c.kind === 'neuropil' ? 0 : 1);
      const order = [...plan.chunks].sort((a, b) => early(a) - early(b) || b.bytes - a.bytes);
      await Promise.all(order.map((c) => this.loadChunk(c)));
      runInAction(() => {
        this.ready = true;
      });
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : String(e);
      });
      throw e;
    }
  }

  async loadChunk(c: ChunkEntry): Promise<void> {
    if (this.payloads.has(c.id) || !this.manifest) return;
    const decoded = await this.worker().load(new URL(c.file, this.baseUrl).href, c.kind, this.manifest.bbox);
    this.payloads.set(c.id, decoded);
    runInAction(() => {
      this.loadedBytes += c.bytes;
      this.loaded.add(c.id);
    });
  }

  private worker(): Remote<DecodeApi> {
    if (this.workers.length === 0) {
      const n = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
      for (let i = 0; i < n; i++) {
        const w = new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' });
        this.workers.push(wrap<DecodeApi>(w));
      }
    }
    const w = this.workers[this.next++ % this.workers.length];
    if (!w) throw new Error('worker pool empty');
    return w;
  }
}

export const data = new DataStore();
