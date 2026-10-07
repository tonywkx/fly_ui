import { type Action, COMMANDS, mulberry32, SENSES, World, type WorldEvent } from '@fly/sim';
import { LiveClient, type Pace } from '@/sim/client';
import type { Backend } from '../engine';
import type { Preset } from '../quality';
import { DishScene, type DishSceneOptions } from './DishScene';
import { DishLoop } from './loop';

const SEED = 1;
/** Shown at ×1/6: a sim ms takes 6 wall ms ("high-speed camera"). */
const SLOW = 6;
/** Closed loop: drive lands ≤ 25 sim ms late (the swatter needs a jump well inside its 120 ms). */
const PACE: Pace = { aheadMs: 20, chunkMs: 5 };
/** A stalled tab does not jump the clock. */
const MAX_FRAME_MS = 100;

export interface DishStatus {
  /** Sim time shown, ms. */
  t: number;
  action: Action;
  paused: boolean;
  /** The live brain is still loading. */
  loading: boolean;
}

export interface DishRunOptions extends DishSceneOptions {
  graphUrl: string;
  metaUrl: string;
  /** Snaps: run as fast as the sim allows up to this sim ms, then hold and call `onReady`. */
  until?: number;
  onReady?: () => void;
  onStatus: (s: DishStatus) => void;
}

/** Owns the dish scene, the world, the live sim and the ×1/6 clock. */
export class DishRun {
  readonly world = new World(mulberry32(SEED));
  paused = false;
  private readonly scene: DishScene;
  private client: LiveClient | null = null;
  private loop: DishLoop | null = null;
  private clock = 0;
  private last = 0;
  private ready = false;
  private disposed = false;

  constructor(
    host: HTMLElement,
    private readonly o: DishRunOptions,
  ) {
    this.scene = new DishScene(host, o);
  }

  /** Renderer up (throws if it cannot start); the live brain loads in the background. */
  async start(): Promise<Backend> {
    const backend = await this.scene.init();
    if (!this.disposed) {
      this.scene.loop((now) => this.frame(now));
      void this.live();
    }
    return backend;
  }

  applyQuality(p: Preset): void {
    this.scene.applyQuality(p);
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  dispose(): void {
    this.disposed = true;
    this.scene.dispose();
    this.client?.dispose();
  }

  private async live(): Promise<void> {
    try {
      const t0 = performance.now();
      const c = await LiveClient.start(
        {
          graphUrl: this.o.graphUrl,
          metaUrl: this.o.metaUrl,
          scenarioBodyIds: new Float64Array(0),
          stim: [],
          seed: SEED,
        },
        PACE,
      );
      if (this.disposed) return c.dispose();
      const senses = await c.groups(SENSES);
      const commands = await c.watch(COMMANDS);
      this.loop = new DishLoop(this.world, senses, commands, { drive: (d) => void c.drive(d) });
      this.client = c;
      console.info(`[dish] live brain in ${(performance.now() - t0).toFixed(0)} ms`);
    } catch (e) {
      console.error('[dish] live sim failed', e);
      this.o.onReady?.();
    }
  }

  private frame(now: number): void {
    const dt = this.last ? Math.min(MAX_FRAME_MS, now - this.last) : 0;
    this.last = now;
    const c = this.client;
    const l = this.loop;
    let ev: WorldEvent[] = [];
    if (c && l) {
      const { until } = this.o;
      if (until !== undefined) this.clock = until;
      else if (!this.paused) this.clock = Math.min(this.clock + dt / SLOW, c.log.until + 1);
      c.pump(this.clock);
      ev = l.advance(this.clock, c.log);
      if (until !== undefined && l.t >= until && !this.ready) {
        this.ready = true;
        this.o.onReady?.();
      }
    }
    const t = l?.t ?? 0;
    this.scene.sync(this.world, l?.action ?? 'walk', t, ev);
    this.o.onStatus({ t, action: l?.action ?? 'walk', paused: this.paused, loading: !l });
  }
}
