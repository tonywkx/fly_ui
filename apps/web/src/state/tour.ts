import { makeAutoObservable, reaction } from 'mobx';
import { type ExperimentStore, experiment } from './experiment';
import { type PlaybackStore, playback } from './playback';

/**
 * First-visit tour of the escape run (docs/TOUR.md): 0 narration while loading · 1 what you see ·
 * 2 scare the fly · 3 now break it · 4 cheat sheet. Steps 2–3 play a run (`running`) and then show
 * its result (`done`); step 3 starts on its setup card (`idle`).
 */
export type TourStep = 0 | 1 | 2 | 3 | 4;
export interface TourState {
  step: TourStep;
  phase: 'idle' | 'running' | 'done';
}
/** `next` = the card's pill (or ready, for the narration); `ended` = the run reached its end. */
export type TourEvent = 'next' | 'again' | 'ended' | 'skip';

/** Tour speed for the runs (¼×: ≈4 s for the escape). */
export const TOUR_SPEED = 0.25;
/** Cell type of the "panic neuron" the tour silences (the Giant Fiber, one per side). */
export const PANIC_TYPE = 'DNp01';

const SCENARIO = 'escape';

/** Pure step machine; `null` = no tour. Events that do not apply leave the state as is. */
export function tourNext(s: TourState | null, e: TourEvent): TourState | null {
  if (!s || e === 'skip') return null;
  const { step, phase } = s;
  if (e === 'ended') return phase === 'running' ? { step, phase: 'done' } : s;
  if (e === 'again') return phase === 'done' ? { step, phase: 'running' } : s;
  if (phase === 'running') return s;
  if (step === 1) return { step: 2, phase: 'running' };
  if (step === 3 && phase === 'idle') return { step: 3, phase: 'running' };
  if (step === 4) return null;
  return { step: (step + 1) as TourStep, phase: 'idle' };
}

/** Where a visit opens the tour: `?tour=<1..4>` wins (even seen / snap), `0` / snap / seen / not escape = off. */
export function startStep(o: {
  params: { snap: boolean; tour?: TourStep };
  seen: boolean;
  scenario: string;
}): TourStep | null {
  const { params, seen, scenario } = o;
  if (scenario !== SCENARIO || params.tour === 0) return null;
  if (params.tour !== undefined) return params.tour;
  return params.snap || seen ? null : 0;
}

/** Scenario rows of the panic neuron type. */
export function panicRows(meta: {
  n: number;
  type: ArrayLike<number>;
  strings: { types: string[] };
}): number[] {
  const code = meta.strings.types.indexOf(PANIC_TYPE);
  const rows: number[] = [];
  if (code < 0) return rows;
  for (let i = 0; i < meta.n; i++) if (meta.type[i] === code) rows.push(i);
  return rows;
}

/** Whether the tour was finished or skipped before (a convenience: storage may be missing). */
export interface TourMemory {
  seen(): boolean;
  markSeen(): void;
}

/** The tour's state and its effects on playback and the experiment. */
export class TourStore {
  state: TourState | null = null;
  /** Rows silenced by "now break it" (set once the scenario's meta has loaded). */
  private panic: number[] = [];

  constructor(
    private readonly pb: PlaybackStore,
    private readonly ex: ExperimentStore,
    private readonly memory: TourMemory,
  ) {
    makeAutoObservable<this, 'panic' | 'pb' | 'ex' | 'memory'>(this, {
      panic: false,
      pb: false,
      ex: false,
      memory: false,
    });
    reaction(
      () => this.pb.ended,
      (ended) => {
        if (ended) this.send('ended');
      },
    );
    // no live sim, no broken fly: on to the cheat sheet
    reaction(
      () => this.ex.live === 'failed' && this.state?.step === 3 && this.state.phase === 'running',
      (failed) => {
        if (failed) this.go({ step: 4, phase: 'idle' });
      },
    );
  }

  get active() {
    return this.state !== null;
  }

  get seen() {
    return this.memory.seen();
  }

  /** How the finished run ended: takeoff at `at` ms, or missed (no takeoff by then). */
  get outcome() {
    return this.state?.phase === 'done' ? this.pb.last : null;
  }

  /** Step 3 waits for the whole brain to load (the live sim). */
  get preparing() {
    return this.state?.step === 3 && this.state.phase === 'running' && this.ex.live === 'loading';
  }

  setPanic(rows: number[]) {
    this.panic = rows;
  }

  /** Opens the tour at `step` (first visit: 0; "?": 1; `?tour=`). */
  start(step: TourStep) {
    this.go(step === 2 ? { step, phase: 'running' } : { step, phase: 'idle' });
  }

  next() {
    this.send('next');
  }

  again() {
    this.send('again');
  }

  skip() {
    this.send('skip');
  }

  private send(e: TourEvent) {
    this.go(tourNext(this.state, e));
  }

  private go(s: TourState | null) {
    const prev = this.state;
    if (s === prev) return;
    this.state = s;
    if (!s) {
      if (prev && prev.step > 0 && prev.step < 4) this.restore();
      this.memory.markSeen();
    } else if (s.phase === 'running' && (prev?.step !== s.step || prev.phase !== 'running')) {
      this.play(s.step === 3);
    } else if (s.step === 1 && prev?.step !== 1) {
      this.pb.restart({ baked: true, paused: true });
    } else if (s.step === 4 && prev?.step !== 4) {
      this.restore();
      this.memory.markSeen();
    }
  }

  /** One run at ¼× from t = 0: the baked escape, or (break) the live sim with every DNp01 silent. */
  private play(broken: boolean) {
    // the whole brain loads while they watch the first run
    this.ex.warmLive();
    this.pb.setSpeed(TOUR_SPEED);
    this.pb.setOnce(true);
    if (!broken) {
      this.ex.clear();
      this.pb.restart({ baked: true });
      return;
    }
    this.ex.load([], this.panic, this.ex.stim);
    // live still loading: held at 0 until it takes over (from rest, playing)
    this.pb.restart({ paused: this.ex.live !== 'on' });
  }

  /** The default baked escape, paused at t = 0 (the broken state is not kept). */
  private restore() {
    this.ex.clear();
    this.pb.setSpeed(1);
    this.pb.setOnce(false);
    this.pb.restart({ baked: true, paused: true });
  }
}

const SEEN_KEY = 'fly_ui.tour';

/** localStorage-backed; missing / throwing storage = never seen, not remembered. */
export const tourMemory: TourMemory = {
  seen() {
    try {
      return localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      return false;
    }
  },
  markSeen() {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // not remembered: fine
    }
  },
};

export const tour = new TourStore(playback, experiment, tourMemory);
