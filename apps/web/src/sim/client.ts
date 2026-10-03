import { type Remote, wrap } from 'comlink';
import { SpikeFeed } from './feed';
import type { LiveInit, SimApi, Tuning } from './sim.worker';

/** Sim time kept buffered ahead of the display clock, and the size of one Worker request (ms). */
const AHEAD_MS = 100;
const CHUNK_MS = 20;
/** Batches after which the measured speed is logged once. */
const SPEED_LOG_AFTER = 20;

/**
 * Main-thread side of the live sim: owns the Worker, keeps `feed` filled ahead of the display
 * clock with at most one `advance` in flight. Batches arrive by transfer (no SharedArrayBuffer:
 * static hosting cannot send COOP/COEP).
 */
export class LiveClient {
  readonly feed = new SpikeFeed();
  /** Sim ms per wall-clock s of Worker round trips, averaged since start (0 until measured). */
  speed = 0;
  private simMs = 0;
  private wallMs = 0;
  private batches = 0;
  private readonly worker: Worker;
  private readonly api: Remote<SimApi>;
  private busy = false;
  private gen = 0;
  private disposed = false;

  private constructor() {
    this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    this.api = wrap<SimApi>(this.worker);
  }

  static async start(init: LiveInit): Promise<LiveClient> {
    const c = new LiveClient();
    try {
      const t0 = performance.now();
      const { n, edges } = await c.api.init(init);
      console.info(`[sim] live: ${n} neurons, ${edges} edges in ${(performance.now() - t0).toFixed(0)} ms`);
      return c;
    } catch (e) {
      c.dispose();
      throw e;
    }
  }

  /** Requests more sim time unless the feed already reaches `t + AHEAD_MS`. Call every frame. */
  pump(t: number): void {
    if (this.busy || this.disposed || this.feed.until >= t + AHEAD_MS) return;
    this.busy = true;
    const gen = this.gen;
    const t0 = performance.now();
    this.api
      .advance(CHUNK_MS)
      .then((b) => {
        if (gen !== this.gen) return;
        this.simMs += CHUNK_MS;
        this.wallMs += performance.now() - t0;
        this.speed = (this.simMs * 1000) / Math.max(1, this.wallMs);
        if (++this.batches === SPEED_LOG_AFTER) console.info(`[sim] ${this.speed.toFixed(0)} sim ms/s`);
        this.feed.push(b.t, b.row, b.until);
      })
      .catch((e) => console.error('[sim]', e))
      .finally(() => {
        this.busy = false;
      });
  }

  /** Poisson drive at `hz` on a scenario row (omitted: the default rate; 0 removes it), kicks × `gain`. */
  stimulate(row: number, hz?: number, gain?: number): Promise<void> {
    return this.api.stimulate(row, hz, gain);
  }

  silence(row: number, on: boolean): Promise<void> {
    return this.api.silence(row, on);
  }

  /** Restarts the scenario at t = 0; a batch still in flight is dropped. */
  async reset(): Promise<void> {
    this.gen++;
    this.feed.reset();
    await this.api.reset();
  }

  /** Restarts the scenario at t = 0 with new params; a batch still in flight is dropped. */
  async tune(t: Tuning): Promise<void> {
    this.gen++;
    this.feed.reset();
    await this.api.tune(t);
  }

  dispose(): void {
    this.disposed = true;
    this.worker.terminate();
  }
}
