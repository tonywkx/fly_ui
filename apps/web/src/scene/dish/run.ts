import {
  type Action,
  COMMANDS,
  type Group,
  mulberry32,
  OPERATIONS,
  PATHS,
  SENSE_HZ,
  SENSES,
  World,
  type WorldEvent,
} from '@fly/sim';
import { LiveClient, type Pace } from '@/sim/client';
import type { Backend } from '../engine';
import type { Preset } from '../quality';
import { DishScene, type DishSceneOptions } from './DishScene';
import type { BrainData } from './holo';
import { DishInput } from './input';
import { type DecisionEvent, DishLoop } from './loop';
import { OPS, type Op, type Outcome } from './verdict';

const SEED = 1;
/** Shown at ×1/6: a sim ms takes 6 wall ms ("high-speed camera"). */
const SLOW = 6;
/** Closed loop: drive lands ≤ 25 sim ms late (the swatter needs a jump well inside its 120 ms). */
const PACE: Pace = { aheadMs: 20, chunkMs: 5 };
/** A stalled tab does not jump the clock. */
const MAX_FRAME_MS = 100;
/** How long a hand's outcome holds the status word, sim ms (≈ 2 s at ×1/6). */
const FLASH_MS = 330;
/** Hologram nodes glow with the spikes of the last few sim ms; full at `HEAT_HZ` per cell. */
const HEAT_MS = 8;
const HEAT_HZ = 100;

/** Cell types on the decision paths past the sense (their spikes flash the hologram nodes). */
const PATH_TYPES = [...new Set(Object.values(PATHS).flatMap((p) => p.hops.slice(1).map((h) => h.type)))];
/** Each path's sense, by its first hop's type. */
const SENSE_OF = new Map(Object.values(PATHS).map((p) => [p.hops[0]?.type ?? '', p.sense]));

/** Status words a hand's strike leaves for a moment. */
export type Flash = 'miss' | 'dodge' | 'back_again';

export interface DishStatus {
  /** Sim time shown, ms. */
  t: number;
  action: Action;
  paused: boolean;
  /** The live brain is still loading. */
  loading: boolean;
  /** A strike's outcome, shown instead of the action for a moment. */
  flash: Flash | null;
  /** Hovered item: its canvas px (for the remove button), or null. */
  hover: { id: number; x: number; y: number } | null;
}

export interface DishRunOptions extends DishSceneOptions {
  graphUrl: string;
  metaUrl: string;
  /** Snaps: run as fast as the sim allows up to this sim ms, then hold and call `onReady`. */
  until?: number;
  onReady?: () => void;
  onStatus: (s: DishStatus) => void;
  /** Cells per operation, once the live brain is up. */
  onCells?: (n: Record<Op, number>) => void;
  /** An operation's last encounter changed (the card's «now» line). */
  onVerdict?: (op: Op, o: Outcome) => void;
  /** The fly just decided (the decision caption); null on a reset. */
  onDecision?: (e: DecisionEvent | null) => void;
}

/** Owns the dish scene, the world, the live sim and the ×1/6 clock. */
export class DishRun {
  readonly world = new World(mulberry32(SEED));
  readonly input: DishInput;
  paused = false;
  private readonly scene: DishScene;
  private flash: { word: Flash; t: number } | null = null;
  private client: LiveClient | null = null;
  private loop: DishLoop | null = null;
  /** Operations wanted by the visitor / applied to the sim, and their full-graph rows. */
  private ops = new Set<Op>();
  private applied = new Set<Op>();
  private opRows: Record<Op, Group> | null = null;
  /** Log rows of each path cell type; spikes per type in the heat window. */
  private pathRows: { type: string; cells: number; has: Uint8Array }[] = [];
  private readonly heat = new Map<string, number>();
  private clock = 0;
  private last = 0;
  private ready = false;
  private disposed = false;

  constructor(
    host: HTMLElement,
    private readonly o: DishRunOptions,
  ) {
    this.scene = new DishScene(host, { ...o, still: o.until !== undefined });
    this.input = new DishInput(host, this.scene, this.world, this);
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

  /** The hologram's chunks arrived. */
  setBrain(d: BrainData): void {
    this.scene.setBrain(d);
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  /** Switches operations on (in the set) and off (not in it); applied once the live brain is up. */
  setOps(ops: Iterable<Op>): void {
    this.ops = new Set(ops);
    this.applyOps();
  }

  /** Items, fly, trail, clock and the brain back to t = 0; operations stay on. */
  reset(): void {
    this.loop?.reset();
    if (!this.loop) this.world.reset();
    // the sim's reset clears silencing and drive: queue the operations again right behind it
    void this.client?.reset();
    this.applied.clear();
    this.applyOps();
    this.clock = 0;
    this.flash = null;
    this.scene.clear();
    this.o.onDecision?.(null);
  }

  dispose(): void {
    this.disposed = true;
    this.input.dispose();
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
      const watched = await c.watch({
        ...COMMANDS,
        ...Object.fromEntries(PATH_TYPES.map((t) => [t, new RegExp(`^${t}$`)])),
      });
      const n = Math.max(0, ...Object.values<Group>(watched).flatMap((g) => [...g.all])) + 1;
      this.pathRows = PATH_TYPES.map((type) => {
        const g = (watched as Record<string, Group>)[type] ?? { all: new Uint32Array(0) };
        const has = new Uint8Array(n);
        for (const r of g.all) has[r] = 1;
        return { type, cells: g.all.length, has };
      });
      this.opRows = await c.groups(
        Object.fromEntries(OPS.map((op) => [op, OPERATIONS[op].types])) as Record<Op, RegExp>,
      );
      this.loop = new DishLoop(this.world, senses, watched, { drive: (d) => void c.drive(d) });
      this.client = c;
      this.o.onCells?.(
        Object.fromEntries(OPS.map((op) => [op, this.opRows?.[op].all.length ?? 0])) as Record<Op, number>,
      );
      this.applyOps();
      console.info(`[dish] live brain in ${(performance.now() - t0).toFixed(0)} ms`);
    } catch (e) {
      console.error('[dish] live sim failed', e);
      this.o.onReady?.();
    }
  }

  /** Brings the sim's operations in line with `ops` (silence for «off», full drive for «on»). */
  private applyOps(): void {
    const c = this.client;
    const g = this.opRows;
    if (!c || !g) return;
    for (const op of OPS) {
      const on = this.ops.has(op);
      if (on === this.applied.has(op)) continue;
      const rows = g[op].all;
      if (OPERATIONS[op].mode === 'off') void c.silenceRows(rows, on);
      else void c.drive({ rows: rows.slice(), hz: new Float32Array(rows.length).fill(on ? SENSE_HZ : 0) });
      if (on) this.applied.add(op);
      else this.applied.delete(op);
    }
    this.scene.setMarks(this.applied);
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
      for (const op of l.changed) {
        const o = l.verdicts.now[op];
        if (o) this.o.onVerdict?.(op, o);
      }
      l.changed.clear();
      const d = l.decisions.at(-1);
      if (d) {
        this.scene.decide(d);
        this.o.onDecision?.(d);
      }
      l.decisions.length = 0;
      this.measureHeat(l.t, c.log);
      if (until !== undefined && l.t >= until && !this.ready) {
        this.ready = true;
        this.o.onReady?.();
      }
    }
    const t = l?.t ?? 0;
    for (const e of ev) {
      // a dodged swing lands on empty glass: keep «dodged»
      const dodged = this.flash?.word === 'dodge' && e.t - this.flash.t <= FLASH_MS;
      if (e.kind === 'miss' && !dodged) this.flash = { word: 'miss', t: e.t };
      else if (e.kind === 'takeoff' && this.world.hands.swatter) this.flash = { word: 'dodge', t: e.t };
      else if (e.kind === 'reassemble') this.flash = { word: 'back_again', t: e.t };
    }
    if (this.flash && (t - this.flash.t > FLASH_MS || t < this.flash.t)) this.flash = null;
    this.scene.sync(this.world, l?.action ?? 'walk', t, ev, this.applied.size > 0);
    this.scene.animate(this.paused ? 0 : dt, this.heat);
    const id = this.input.hover;
    const it = id === null ? undefined : this.world.items.find((i) => i.id === id);
    this.o.onStatus({
      t,
      action: l?.action ?? 'walk',
      paused: this.paused,
      loading: !l,
      flash: this.flash?.word ?? null,
      hover: it ? { id: it.id, ...this.scene.project(it.x, it.y) } : null,
    });
  }

  /** Hologram node levels: path cells' recent spikes, and what the fly senses for the first hops. */
  private measureHeat(t: number, log: LiveClient['log']): void {
    const [i0, i1] = log.span(t - HEAT_MS, t);
    const full = (HEAT_HZ * HEAT_MS) / 1000;
    for (const p of this.pathRows) {
      let k = 0;
      for (let i = i0; i < i1; i++) k += p.has[log.rows[i] as number] ?? 0;
      this.heat.set(p.type, Math.min(1, k / Math.max(1, p.cells) / full));
    }
    const s = this.world.sense();
    for (const [type, sense] of SENSE_OF) {
      const v = s[sense];
      this.heat.set(type, typeof v === 'number' ? v : Math.max(v.L, v.R));
    }
  }
}
