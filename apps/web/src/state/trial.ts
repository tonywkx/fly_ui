import { OPERATIONS } from '@fly/sim';
import { makeAutoObservable, toJS } from 'mobx';
import {
  type CardStimulus,
  chips,
  DISCOVERIES,
  type Discovery,
  decides,
  discovery,
  normOf,
  type Pair,
  pairId,
  parsePair,
  type Result,
  readCell,
  shuffle,
} from '../scene/dish/discoveries';
import { type Brain, NORM, type Norm } from '../scene/dish/table';
import type { TakeResult } from '../scene/dish/take';

/** The card's flow (docs/EXPERIMENT-SHAPE.md §Card); the bet is part of setup. */
export type Phase = 'setup' | 'running' | 'result';
/** The card's two tabs: «Опыт» and «Открытия». */
export type CardTab = 'exp' | 'found';
/** What «Что меняем в мозге» holds: nothing, one named op, or the cells picked in the brain view (SURGEON-SHAPE §Flow). */
export type Slot = Brain | 'brain';
/** Cells the brain view switched off / on (`?x=`), as counts. */
export interface Picks {
  off: number;
  on: number;
}
/** An op's site on the hologram: its neuropil and what it does there. */
export interface Site {
  region: string;
  mode: 'off' | 'on';
}

/** What the hologram lights for a row: an op's region, the whole brain (`all`), or nothing. */
export function litOf(s: Slot): Site | 'all' | null {
  if (s === 'none') return null;
  if (s === 'brain') return 'all';
  const { region, mode } = OPERATIONS[s];
  return { region, mode };
}

/** A pair's first run: the bet made before it and what came out. */
export interface Entry {
  bet: Result | null;
  result: Result;
  ms: number | null;
  /** The rate the «сейчас» row reads (`readCell`): the decision's command, else the norm's. */
  hz: number;
}

/** Every pair run so far (first runs only) and the last one, persisted per browser. */
export interface Journal {
  pairs: Record<string, Entry>;
  last: string | null;
}

/** A finished run next to the norm. */
export interface Outcome extends TakeResult {
  pair: Pair;
  /** The normal fly with this stimulus (the «обычно» row), from `NORM`. */
  norm: Norm;
  /** The pair's bet (this run's on the first one, the old one on repeats; greyed then). */
  bet: Result | null;
  first: boolean;
  /** The discovery this run unlocked. */
  unlocked: Discovery | null;
}

/**
 * The experiment card's model (9.3): slots, bet, phases, the result vs the norm table, the
 * journal and discoveries. The scene runs the take on `run` and reports back with `finish`.
 */
export class TrialStore {
  stim: CardStimulus | null = null;
  slot: Slot = 'none';
  /** The brain view's cells, kept while a named op holds the slot; «вернуть» on their chip forgets them. */
  picks: Picks | null = null;
  /** The op list's hovered / focused row (the hologram previews it). */
  preview: Slot | null = null;
  phase: Phase = 'setup';
  tab: CardTab = 'exp';
  bet: Result | null = null;
  /** Ask for a bet even on a pair already run (the onboarding's steps); cleared by a result. */
  ask = false;
  /** Bumped on each start: the scene clears the arena and runs the pair. */
  run = 0;
  outcome: Outcome | null = null;
  /** The result's slow replay is on (EXPERIMENT-SHAPE §Replay). */
  replaying = false;
  pairs: Record<string, Entry>;

  constructor(
    private readonly memory: TrialMemory = trialMemory,
    /** Chip order per visit. */
    private readonly seed = (Math.random() * 2 ** 32) >>> 0,
  ) {
    const j = memory.load();
    this.pairs = j.pairs;
    const last = j.last ? parsePair(j.last) : null;
    if (last) ({ stim: this.stim, op: this.slot } = last);
    makeAutoObservable<this, 'memory' | 'seed'>(this, { memory: false, seed: false });
  }

  /** The named op in force ('none' while the slot holds brain picks). */
  get op(): Brain {
    return this.slot === 'brain' ? 'none' : this.slot;
  }

  /** The brain picks on in the fly now. */
  get applied(): Picks | null {
    return this.slot === 'brain' ? this.picks : null;
  }

  /** What the hologram lights for the hovered row. */
  get lit(): Site | 'all' | null {
    return this.preview === null ? null : litOf(this.preview);
  }

  /** The named op marked on the hologram while it is in force (brain picks have no site in the dish). */
  get operated(): Site | null {
    const l = litOf(this.op);
    return l === 'all' ? null : l;
  }

  get pair(): Pair | null {
    return this.stim ? { stim: this.stim, op: this.op } : null;
  }

  /** The pair was never run: «Запустить» waits for a bet. Brain picks have no norm pair: no bet. */
  get needsBet(): boolean {
    return !!this.pair && !this.applied && (this.ask || !this.pairs[pairId(this.pair)]);
  }

  get canRun(): boolean {
    return this.phase !== 'running' && !!this.pair && (!this.needsBet || !!this.bet);
  }

  get chips(): Result[] {
    const p = this.pair;
    return p ? shuffle(chips(p), this.seed ^ hash(pairId(p))) : [];
  }

  get found(): Discovery[] {
    return DISCOVERIES.filter((d) => this.pairs[d.id]);
  }

  get allFound(): boolean {
    return this.found.length === DISCOVERIES.length;
  }

  /** Tabs stay put while a run or its replay is on. */
  setTab(tab: CardTab): void {
    if (this.phase !== 'running' && !this.replaying) this.tab = tab;
  }

  setStim(s: CardStimulus | null): void {
    this.slots(s, this.slot);
  }

  /** «brain» only with picks to put back on. */
  setSlot(s: Slot): void {
    if (s !== 'brain' || this.picks) this.slots(this.stim, s);
  }

  setOp(op: Brain): void {
    this.setSlot(op);
  }

  /** Back from the brain view with its cells: they fill the slot (none picked = nothing kept). */
  setPicks(p: Picks | null): void {
    this.picks = p && p.off + p.on > 0 ? p : null;
    if (this.picks) this.setSlot('brain');
    else if (this.slot === 'brain') this.slots(this.stim, 'none');
  }

  forgetPicks(): void {
    this.setPicks(null);
  }

  setPreview(s: Slot | null): void {
    this.preview = s;
  }

  setBet(b: Result | null): void {
    this.bet = b;
  }

  setAsk(on: boolean): void {
    this.ask = on;
  }

  /** Starts a run if it can (`force`: without the bet, `?run=1`); the scene reacts to `run`. */
  start(force = false): boolean {
    if (!(this.canRun || (force && this.phase !== 'running' && this.pair))) return false;
    this.phase = 'running';
    this.tab = 'exp';
    this.outcome = null;
    this.replaying = false;
    this.run++;
    return true;
  }

  /** Aborts the run back to setup; nothing recorded. */
  stop(): void {
    if (this.phase === 'running') this.phase = 'setup';
  }

  /** The scene's take is over. */
  finish(t: TakeResult): void {
    const p = this.pair;
    if (this.phase !== 'running' || !p) return;
    const id = pairId(p);
    // brain picks: no norm pair, nothing to remember (SURGEON-SHAPE §Any neuron)
    const own = !this.applied;
    const old = own ? this.pairs[id] : undefined;
    // the very first result plays its replay by itself
    this.replaying = Object.keys(this.pairs).length === 0;
    const norm = NORM[p.stim].none;
    const cell = readCell(t.result, norm);
    const hz = decides(t.result) ? t.hz : cell ? Math.round(t.peak[cell]) : 0;
    if (own && !old) this.pairs[id] = { bet: this.bet, result: t.result, ms: t.ms, hz };
    this.outcome = {
      ...t,
      pair: p,
      norm,
      bet: old && !this.ask ? old.bet : this.bet,
      first: own && !old,
      unlocked: own && !old ? discovery(p) : null,
    };
    this.phase = 'result';
    this.bet = null;
    this.ask = false;
    if (own) this.memory.save({ pairs: toJS(this.pairs), last: id });
  }

  /** «Повтор»: only on a result. */
  replay(): boolean {
    if (this.phase !== 'result') return false;
    this.replaying = true;
    return true;
  }

  closeReplay(): void {
    this.replaying = false;
  }

  /** «ещё раз»: the same pair, no bet. */
  again(): void {
    this.start();
  }

  /** «новый опыт»: back to setup, slots kept. */
  fresh(): void {
    if (this.phase === 'running') return;
    this.phase = 'setup';
    this.outcome = null;
    this.replaying = false;
  }

  /** «Повторить опыт» from a discovery (or `?exp=`): fills the slots, back to «Опыт». */
  repeat(id: string): void {
    const p = parsePair(id);
    if (!p || this.phase === 'running') return;
    this.slots(p.stim, p.op);
    this.tab = 'exp';
  }

  private slots(stim: CardStimulus | null, slot: Slot): void {
    if (this.phase === 'running') return;
    if (stim === this.stim && slot === this.slot) return;
    this.stim = stim;
    this.slot = slot;
    this.bet = null;
    this.tab = 'exp';
    this.fresh();
  }
}

/** FNV-1a: a pair's own chip order from the visit seed. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

const RESULTS: readonly Result[] = ['walk', 'jump', 'back', 'eat', 'court', 'hit'];
const isResult = (x: unknown): x is Result => RESULTS.includes(x as Result);
const isMs = (x: unknown): x is number | null => x === null || typeof x === 'number';

/** Whatever was stored → a journal of valid pairs only. */
export function parseJournal(raw: unknown): Journal {
  const m = raw as { pairs?: unknown; last?: unknown } | null;
  const pairs: Record<string, Entry> = {};
  if (m?.pairs && typeof m.pairs === 'object')
    for (const [id, e] of Object.entries(m.pairs as Record<string, Partial<Entry> | null>)) {
      const p = parsePair(id);
      if (!p || pairId(p) !== id || !e || typeof e !== 'object') continue;
      const { bet = null, result, ms = null, hz = 0 } = e;
      if ((bet === null || isResult(bet)) && isResult(result) && isMs(ms) && typeof hz === 'number')
        pairs[id] = { bet, result, ms, hz };
    }
  const last = typeof m?.last === 'string' && parsePair(m.last) ? m.last : null;
  return { pairs, last };
}

/** Puzzles solved in Phase 8 (`fly_ui.levels`) count as their discoveries, with the norm's numbers. */
export function fromLevels(solved: readonly number[]): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const d of DISCOVERIES) {
    if (d.level === undefined || !solved.includes(d.level)) continue;
    const n = NORM[d.stim][d.op];
    out[d.id] = { bet: null, result: normOf(d), ms: n.ms, hz: n.hz };
  }
  return out;
}

export interface TrialMemory {
  load(): Journal;
  save(j: Journal): void;
}

const FOUND_KEY = 'fly_ui.found';
const LEVELS_KEY = 'fly_ui.levels';

/** localStorage-backed; missing / throwing storage = an empty journal, nothing remembered. */
export const trialMemory: TrialMemory = {
  load() {
    try {
      const raw = localStorage.getItem(FOUND_KEY);
      if (raw !== null) return parseJournal(JSON.parse(raw));
      const solved = JSON.parse(localStorage.getItem(LEVELS_KEY) ?? 'null')?.solved;
      return { pairs: fromLevels(Array.isArray(solved) ? solved : []), last: null };
    } catch {
      return { pairs: {}, last: null };
    }
  },
  save(j) {
    try {
      localStorage.setItem(FOUND_KEY, JSON.stringify(j));
    } catch {
      // not remembered: fine
    }
  },
};

export const trial = new TrialStore();
