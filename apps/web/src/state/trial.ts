import { makeAutoObservable, toJS } from 'mobx';
import {
  type CardStimulus,
  chips,
  DISCOVERIES,
  type Discovery,
  discovery,
  normOf,
  type Pair,
  pairId,
  parsePair,
  type Result,
  shuffle,
} from '../scene/dish/discoveries';
import { type Brain, NORM, type Norm } from '../scene/dish/table';
import type { TakeResult } from '../scene/dish/take';

/** The card's flow (docs/EXPERIMENT-SHAPE.md §Card); the bet is part of setup. */
export type Phase = 'setup' | 'running' | 'result';

/** A pair's first run: the bet made before it and what came out. */
export interface Entry {
  bet: Result | null;
  result: Result;
  ms: number | null;
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
  op: Brain = 'none';
  phase: Phase = 'setup';
  bet: Result | null = null;
  /** Bumped on each start: the scene clears the arena and runs the pair. */
  run = 0;
  outcome: Outcome | null = null;
  pairs: Record<string, Entry>;

  constructor(
    private readonly memory: TrialMemory = trialMemory,
    /** Chip order per visit. */
    private readonly seed = (Math.random() * 2 ** 32) >>> 0,
  ) {
    const j = memory.load();
    this.pairs = j.pairs;
    const last = j.last ? parsePair(j.last) : null;
    if (last) ({ stim: this.stim, op: this.op } = last);
    makeAutoObservable<this, 'memory' | 'seed'>(this, { memory: false, seed: false });
  }

  get pair(): Pair | null {
    return this.stim ? { stim: this.stim, op: this.op } : null;
  }

  /** The pair was never run: «Запустить» waits for a bet. */
  get needsBet(): boolean {
    return !!this.pair && !this.pairs[pairId(this.pair)];
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

  setStim(s: CardStimulus | null): void {
    this.slots(s, this.op);
  }

  setOp(op: Brain): void {
    this.slots(this.stim, op);
  }

  setBet(b: Result | null): void {
    this.bet = b;
  }

  /** Starts a run if it can; the scene reacts to `run`. */
  start(): boolean {
    if (!this.canRun) return false;
    this.phase = 'running';
    this.outcome = null;
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
    const old = this.pairs[id];
    if (!old) this.pairs[id] = { bet: this.bet, result: t.result, ms: t.ms, hz: t.hz };
    this.outcome = {
      ...t,
      pair: p,
      norm: NORM[p.stim].none,
      bet: old ? old.bet : this.bet,
      first: !old,
      unlocked: old ? null : discovery(p),
    };
    this.phase = 'result';
    this.bet = null;
    this.memory.save({ pairs: toJS(this.pairs), last: id });
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
  }

  /** «Повторить опыт» from a discovery (or `?exp=`): fills the slots. */
  repeat(id: string): void {
    const p = parsePair(id);
    if (!p || this.phase === 'running') return;
    this.slots(p.stim, p.op);
  }

  private slots(stim: CardStimulus | null, op: Brain): void {
    if (this.phase === 'running') return;
    if (stim === this.stim && op === this.op) return;
    this.stim = stim;
    this.op = op;
    this.bet = null;
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
