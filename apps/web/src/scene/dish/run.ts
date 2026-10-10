import {
  type Action,
  COMMANDS,
  delivery,
  diffDrive,
  type Group,
  OPERATIONS,
  PATHS,
  PUPPET,
  type PuppetKey,
  SENSE_HZ,
  SENSES,
  type Stimulus,
  World,
  type WorldEvent,
} from '@fly/sim';
import { LiveClient, type Pace } from '@/sim/client';
import type { SharedExperiment } from '@/state/share';
import type { Backend } from '../engine';
import type { Preset } from '../quality';
import { DishScene, type DishSceneOptions } from './DishScene';
import type { Band } from './frame';
import type { BrainData } from './holo';
import { DishInput } from './input';
import { type DecisionEvent, DishLoop, type Pull } from './loop';
import { Clip, snap, span, Tape } from './replay';
import { SlowMo } from './slowmo';
import { NORM } from './table';
import { Take, type TakeResult, TIMEOUT } from './take';
import { threadReplay } from './thread';
import { OPS, type Op, type Outcome } from './verdict';
import { explain, type PathRow, type WhyHop } from './why';

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
/** Replay: a sim ms takes this many wall ms. */
export const REPLAY_SLOW = 60;

/** Cell types on the decision paths past the sense (their spikes flash the hologram nodes). */
const PATH_TYPES = [...new Set(Object.values(PATHS).flatMap((p) => p.hops.slice(1).map((h) => h.type)))];
/** Each path's sense, by its first hop's type. */
const SENSE_OF = new Map(Object.values(PATHS).map((p) => [p.hops[0]?.type ?? '', p.sense]));
/** Hologram node types in the order a replay frame keeps their heat. */
const HEAT_TYPES = [...PATH_TYPES, ...SENSE_OF.keys()];

const PUPPET_KEYS = Object.keys(PUPPET) as PuppetKey[];

/** Status words a hand's strike leaves for a moment. */
export type Flash = 'miss' | 'dodge' | 'back_again';

/** The replay's clock (sim ms) and range. */
export interface ReplayStatus {
  t: number;
  t0: number;
  t1: number;
  playing: boolean;
}

/** What the last run's replay explains: its first decision, or the norm's one it missed (`missed`). */
export interface Recorded {
  e: DecisionEvent | null;
  why: WhyHop[] | null;
  missed: boolean;
}

export interface DishStatus {
  /** Sim time shown, ms. */
  t: number;
  action: Action;
  paused: boolean;
  /** The live brain is still loading. */
  loading: boolean;
  /** A strike's outcome, shown instead of the action for a moment. */
  flash: Flash | null;
  /** The real slow-motion denominator: 6 unless the live brain falls behind. */
  slow: number;
  /** Hovered item: its canvas px (for the remove button), or null. */
  hover: { id: number; x: number; y: number } | null;
  /** An experiment run's share of its timeout (0–1), or null with none running. */
  trial: number | null;
  /** The replay playing, or null when the dish is live. */
  replay: ReplayStatus | null;
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
  onDecision?: (e: DecisionEvent | null, why?: WhyHop[]) => void;
  /** A run was recorded (its replay can open). */
  onRecorded?: (r: Recorded) => void;
  /** The zoom began (`true`) / landed back in the dish (`false`). */
  onZoom?: (on: boolean) => void;
  /** The dive reached the black seam: time to become the brain view. */
  onDive?: () => void;
  /** Cells silenced / driven in the brain view (`?x=`, by bodyId), put on in the fly. */
  experiment?: SharedExperiment;
  /** Of those, the cells found in the full graph, once the live brain is up; null once cleared. */
  onBrain?: (n: { off: number; on: number } | null) => void;
}

/** Owns the dish scene, the world, the live sim and the ×1/6 clock. */
export class DishRun {
  readonly world = new World(SEED);
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
  /** Keys held (puppet mode) and the puppet cells' full-graph rows. */
  private pulls = new Set<Pull>();
  private puppetRows: Record<PuppetKey, Group> | null = null;
  /** Row → Hz sent for «on» operations and puppet keys (one map: ↓ and «moon» share MDN). */
  private driven = new Map<number, number>();
  /** The brain view's experiment in full-graph rows (kept across resets, like the operations). */
  private brain: { off: Uint32Array; on: Uint32Array; hz: number; gain: number } | null = null;
  /** Log rows of each path cell type; spikes per type in the heat window. */
  private pathRows: PathRow[] = [];
  /** Cells per sensory group (the «why?» card's first hop). */
  private senseCells: Partial<Record<keyof typeof SENSES, number>> = {};
  /** Paused by the «why?» card (its close resumes). */
  private held = false;
  /** The experiment run in progress and who wants its result; the norm's sense onset and its first-decision chain. */
  private take: {
    take: Take;
    done: (r: TakeResult) => void;
    stim: Stimulus;
    onset: { t: number; side: 'L' | 'R' | null } | null;
    why: WhyHop[] | null;
  } | null = null;
  /** The run's frames (recorded while a take runs), the last run's clip and the replay playing it. */
  private readonly tape = new Tape();
  private readonly heatRow = new Float32Array(HEAT_TYPES.length);
  private recording: (Recorded & { clip: Clip; marked: boolean }) | null = null;
  private rp: { t: number; shown: number; playing: boolean } | null = null;
  private readonly heat = new Map<string, number>();
  private clock = 0;
  /** The real slow-motion (the world waits for a slow brain): the timecode's «×1/N». */
  private readonly pace = new SlowMo(SLOW);
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

  /** Px of chrome over each side of the picture: the dish centres in the band between. */
  frameBand(band: Band): void {
    this.scene.frameBand(band);
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
    this.held = false;
  }

  /** The «why?» card: freeze on open; on close resume only if the card froze it. */
  hold(on: boolean): void {
    if (on && !this.paused) this.paused = this.held = true;
    else if (!on && this.held) this.paused = this.held = false;
  }

  /** «From fly to neuron»: dives into the head, `onDive` at the black seam. `at` freezes it (snaps). */
  dive(at?: number): void {
    if (this.scene.zooming) return;
    this.o.onZoom?.(true);
    this.scene.dive(() => this.o.onDive?.(), at);
  }

  /** Back from the brain view: flies out of the head, then the dish runs. */
  arrive(at?: number): void {
    this.o.onZoom?.(true);
    this.scene.arrive(at);
    // frozen at its end (snaps): already landed
    if (!this.scene.zooming) this.o.onZoom?.(false);
  }

  /** A zoom is flying or a replay is on: the dish holds still and takes no input. */
  get zooming(): boolean {
    return this.scene.zooming || this.rp !== null;
  }

  /** Switches operations on (in the set) and off (not in it); applied once the live brain is up. */
  setOps(ops: Iterable<Op>): void {
    this.ops = new Set(ops);
    this.applyOps();
  }

  /** Puppet mode: the keys held now (cells driven, steering); applied once the live brain is up. */
  setPulls(keys: Iterable<Pull>): void {
    this.pulls = new Set(keys);
    this.steer();
    this.applyDrive();
  }

  /**
   * An experiment run (EXPERIMENT-SHAPE §Loop): a clean dish, the stimulus delivered by script,
   * `done` at the first decision + a tail or at the timeout. False while the live brain loads.
   */
  trial(stim: Stimulus, done: (r: TakeResult) => void): boolean {
    const l = this.loop;
    if (!l) return false;
    this.reset();
    l.script = delivery(stim);
    this.take = { take: new Take(l.t), done, stim, onset: null, why: null };
    this.tape.clear();
    l.record = (t, events) => this.tapeFrame(t, events);
    return true;
  }

  /** Aborts the run: the script stops, nothing is reported. */
  stopTrial(): void {
    this.take = null;
    if (this.loop) this.loop.script = this.loop.record = null;
  }

  /**
   * Opens the last run's replay (the live dish holds) or closes it. `at` (sim ms) opens it paused
   * there (snaps); reduced motion opens it paused on the decision frame. False with nothing recorded.
   */
  replay(on: boolean, at?: number): boolean {
    const r = this.recording;
    if (!on) {
      if (this.rp && r) this.endReplay(r.clip);
      return true;
    }
    if (!r) return false;
    if (this.rp) return true;
    const still = at !== undefined || !!this.o.reducedMotion;
    const t = at ?? (this.o.reducedMotion ? (r.e?.t ?? r.clip.t1) : r.clip.t0);
    this.scene.clear();
    this.rp = { t: this.clamp(t), shown: -Infinity, playing: !still };
    return true;
  }

  /** Replay play / pause; from the end it starts over. */
  toggleReplay(): void {
    const rp = this.rp;
    const r = this.recording;
    if (!rp || !r) return;
    if (!rp.playing && rp.t >= r.clip.t1) rp.t = r.clip.t0;
    rp.playing = !rp.playing;
  }

  /** Replay to sim ms `t` (`pause`: and hold there). */
  seekReplay(t: number, pause = true): void {
    if (!this.rp) return;
    this.rp.t = this.clamp(t);
    if (pause) this.rp.playing = false;
  }

  /** Replay a step of `ms` sim ms forward / back, paused. */
  stepReplay(ms: number): void {
    if (this.rp) this.seekReplay(this.rp.t + ms);
  }

  /** Items, fly, trail, clock and the brain back to t = 0; operations and held keys stay on. */
  reset(): void {
    this.take = null;
    this.rp = null;
    this.scene.replayThread(null);
    this.loop?.reset();
    if (!this.loop) this.world.reset();
    this.steer();
    // the sim's reset clears silencing and drive: queue the operations again right behind it
    void this.client?.reset();
    this.applied.clear();
    this.driven = new Map();
    this.applyOps();
    this.applyBrain(true);
    this.clock = 0;
    this.pace.reset();
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
      this.senseCells = Object.fromEntries(Object.entries(senses).map(([k, g]) => [k, g.all.length]));
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
      this.puppetRows = await c.groups(
        Object.fromEntries(PUPPET_KEYS.map((k) => [k, PUPPET[k].types])) as Record<PuppetKey, RegExp>,
      );
      this.loop = new DishLoop(this.world, senses, watched, { drive: (d) => void c.drive(d) });
      this.client = c;
      this.o.onCells?.(
        Object.fromEntries(OPS.map((op) => [op, this.opRows?.[op].all.length ?? 0])) as Record<Op, number>,
      );
      this.applyOps();
      const x = this.o.experiment;
      if (x) {
        const [off, on] = await Promise.all([
          c.rowsOf(Float64Array.from(x.silenced)),
          c.rowsOf(Float64Array.from(x.stimulated)),
        ]);
        if (this.disposed) return;
        this.brain = { off, on, ...x.stim };
        this.applyBrain(true);
        this.o.onBrain?.({ off: off.length, on: on.length });
      }
      console.info(`[dish] live brain in ${(performance.now() - t0).toFixed(0)} ms`);
    } catch (e) {
      console.error('[dish] live sim failed', e);
      this.o.onReady?.();
    }
  }

  /** Takes the brain view's experiment off the fly. */
  clearBrain(): void {
    if (!this.brain) return;
    this.applyBrain(false);
    this.brain = null;
    this.o.onBrain?.(null);
  }

  /** Puts the brain view's silencing and drive on (or takes it off) the sim. */
  private applyBrain(on: boolean): void {
    const c = this.client;
    const b = this.brain;
    if (!c || !b) return;
    if (b.off.length) void c.silenceRows(b.off, on);
    if (b.on.length)
      void c.drive({ rows: b.on.slice(), hz: new Float32Array(b.on.length).fill(on ? b.hz : 0) }, b.gain);
  }

  /** Brings the sim's operations in line with `ops` (silence for «off», full drive for «on»). */
  private applyOps(): void {
    const c = this.client;
    const g = this.opRows;
    if (!c || !g) return;
    for (const op of OPS) {
      const on = this.ops.has(op);
      if (on === this.applied.has(op)) continue;
      if (OPERATIONS[op].mode === 'off') void c.silenceRows(g[op].all, on);
      if (on) this.applied.add(op);
      else this.applied.delete(op);
    }
    this.applyDrive();
    this.scene.setMarks(this.applied);
  }

  /** Full drive on the cells of «on» operations and held puppet keys; only changes are sent. */
  private applyDrive(): void {
    const c = this.client;
    const ops = this.opRows;
    const keys = this.puppetRows;
    if (!c || !ops || !keys) return;
    const next = new Map<number, number>();
    const put = (rows: Uint32Array, hz: number) => {
      for (const r of rows) next.set(r, Math.max(next.get(r) ?? 0, hz));
    };
    for (const op of this.applied) if (OPERATIONS[op].mode === 'on') put(ops[op].all, SENSE_HZ);
    for (const k of PUPPET_KEYS) if (this.pulls.has(k)) put(keys[k].all, PUPPET[k].hz);
    const d = diffDrive(this.driven, next);
    this.driven = next;
    if (d.rows.length) void c.drive(d);
  }

  /** ← → turn the walker (scripted: the model has no steering cells); both at once cancel. */
  private steer(): void {
    this.world.steer = ((this.pulls.has('left') ? 1 : 0) - (this.pulls.has('right') ? 1 : 0)) as -1 | 0 | 1;
  }

  private frame(now: number): void {
    const dt = this.last ? Math.min(MAX_FRAME_MS, now - this.last) : 0;
    this.last = now;
    const zooming = this.scene.zooming;
    this.scene.flight(dt);
    if (zooming && !this.scene.zooming) this.o.onZoom?.(false);
    if (this.rp && this.recording) {
      this.replayFrame(dt, this.rp, this.recording);
      return;
    }
    const still = this.paused || zooming;
    const c = this.client;
    const l = this.loop;
    let ev: WorldEvent[] = [];
    if (c && l) {
      const { until } = this.o;
      if (until !== undefined) this.clock = until;
      else if (!still) {
        const was = this.clock;
        this.clock = Math.min(this.clock + dt / SLOW, c.log.until + 1);
        this.pace.add(this.clock - was, dt);
      }
      c.pump(this.clock);
      ev = l.advance(this.clock, c.log);
      for (const op of l.changed) {
        const o = l.verdicts.now[op];
        if (o) this.o.onVerdict?.(op, o);
      }
      l.changed.clear();
      const last = l.decisions.at(-1);
      // no sense behind it but a key held for it: the visitor's hand
      const pull =
        last &&
        last.ms === null &&
        PUPPET_KEYS.find((k) => this.pulls.has(k) && PUPPET[k].decision === last.action);
      const d = last && pull ? { ...last, pull } : last;
      if (d) {
        this.scene.decide(d);
        this.o.onDecision?.(d, explain(d, c.log, this.pathRows, this.senseCells[PATHS[d.action].sense] ?? 0));
      }
      const k = this.take;
      if (k) {
        k.take.feed(l.decisions, ev);
        const first = k.take.decision;
        if (first && !k.why) k.why = this.explain(first);
      }
      l.decisions.length = 0;
      if (k?.take.done(l.t)) {
        this.take = null;
        l.record = null;
        this.keep(k, l.t);
        k.done(k.take.result(l.peak));
      }
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
    this.scene.sync(this.world, l?.action ?? 'walk', t, ev, this.applied.size > 0 || !!this.brain);
    this.scene.animate(still ? 0 : dt, this.heat);
    const id = this.input.hover;
    const it = id === null ? undefined : this.world.items.find((i) => i.id === id);
    this.o.onStatus({
      t,
      action: l?.action ?? 'walk',
      paused: this.paused,
      loading: !l,
      flash: this.flash?.word ?? null,
      slow: this.pace.slow,
      hover: it ? { id: it.id, ...this.scene.project(it.x, it.y) } : null,
      trial: this.take ? Math.min(1, (t - this.take.take.t0) / TIMEOUT) : null,
      replay: null,
    });
  }

  /** A replay frame: the clip at the replay clock, its heat and the thread at their recorded time. */
  private replayFrame(
    dt: number,
    rp: NonNullable<DishRun['rp']>,
    r: NonNullable<DishRun['recording']>,
  ): void {
    const { clip } = r;
    if (rp.playing) {
      rp.t = Math.min(clip.t1, rp.t + dt / REPLAY_SLOW);
      if (rp.t >= clip.t1) rp.playing = false;
    }
    this.showClip(clip, rp, r.marked);
    const f = clip.at(rp.t);
    for (const [i, type] of HEAT_TYPES.entries()) this.heat.set(type, f.heat[i] ?? 0);
    const silent = r.why?.findIndex((h) => h.fired === 0) ?? -1;
    this.scene.replayThread({
      e: r.e,
      look: r.e && threadReplay(rp.t, r.e, !!this.o.reducedMotion),
      upTo: r.missed && silent >= 0 ? silent + 1 : null,
    });
    this.scene.animate(dt, this.heat);
    this.o.onStatus({
      t: rp.t,
      action: f.action,
      paused: !rp.playing,
      loading: false,
      flash: null,
      slow: REPLAY_SLOW,
      hover: null,
      trial: null,
      replay: { t: rp.t, t0: clip.t0, t1: clip.t1, playing: rp.playing },
    });
  }

  /** Brings the scene to the replay clock: new frames forward, from the clip's start when going back. */
  private showClip(clip: Clip, rp: { t: number; shown: number }, marked: boolean): void {
    if (rp.t < rp.shown) {
      this.scene.clear();
      rp.shown = -Infinity;
    }
    for (const f of clip.between(rp.shown, rp.t)) this.scene.sync(f, f.action, f.t, f.events, marked);
    rp.shown = Math.max(rp.shown, clip.at(rp.t).t);
  }

  /** Back to live: the scene replays the whole clip (trail, a flight in progress), then the world takes over. */
  private endReplay(clip: Clip): void {
    this.rp = null;
    this.scene.replayThread(null);
    this.scene.clear();
    this.showClip(clip, { t: clip.t1, shown: -Infinity }, this.applied.size > 0 || !!this.brain);
  }

  private clamp(t: number): number {
    const c = this.recording?.clip;
    return c ? Math.max(c.t0, Math.min(c.t1, t)) : t;
  }

  /** A decision's chain from the live log (the replay caption). */
  private explain(d: DecisionEvent): WhyHop[] | null {
    const c = this.client;
    return c ? explain(d, c.log, this.pathRows, this.senseCells[PATHS[d.action].sense] ?? 0) : null;
  }

  /** A tick of the run: its frame on the tape; the norm's sense onset (a missed decision is explained from there). */
  private tapeFrame(t: number, events: readonly WorldEvent[]): void {
    const c = this.client;
    const l = this.loop;
    const k = this.take;
    if (!c || !l || !k) return;
    this.measureHeat(t, c.log);
    for (const [i, type] of HEAT_TYPES.entries()) this.heatRow[i] = this.heat.get(type) ?? 0;
    this.tape.push(snap(this.world, l.action, t, events, this.heatRow));
    const want = NORM[k.stim].none.action;
    if (k.onset || want === 'walk') return;
    const v = this.world.sense()[PATHS[want].sense];
    if (typeof v === 'number' ? v > 0 : v.L > 0 || v.R > 0)
      k.onset = { t, side: typeof v === 'number' ? null : v.L >= v.R ? 'L' : 'R' };
  }

  /** The finished run's clip: around its first decision, or around the norm's decision it missed. */
  private keep(k: NonNullable<DishRun['take']>, t1: number): void {
    let e = k.take.decision;
    let why = k.why;
    let missed = false;
    const n = NORM[k.stim].none;
    if (!e && n.action !== 'walk' && k.onset) {
      const ms = n.ms ?? 0;
      e = { action: n.action, t: k.onset.t + ms, ms: n.ms === null ? null : ms, side: k.onset.side };
      why = this.explain(e);
      missed = true;
    }
    const [a, b] = span(e, k.take.t0, t1);
    const frames = this.tape.clip(a, b);
    this.tape.clear();
    if (!frames.length) return;
    this.recording = {
      clip: new Clip(frames),
      e,
      why,
      missed,
      marked: this.applied.size > 0 || !!this.brain,
    };
    this.o.onRecorded?.({ e, why, missed });
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
