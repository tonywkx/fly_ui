import { makeAutoObservable, reaction } from 'mobx';
import { type Pair, pairId } from '../scene/dish/discoveries';
import { type TrialStore, trial } from './trial';

/** 0 = off; 1..4 = EXPERIMENT-SHAPE §First visit. */
export type OnbStep = 0 | 1 | 2 | 3 | 4;

/** The pair each step stands on: the swatter, then the swatter with the escape neuron off. */
const PAIRS: Record<Exclude<OnbStep, 0>, Pair> = {
  1: { stim: 'swatter', op: 'none' },
  2: { stim: 'swatter', op: 'none' },
  3: { stim: 'swatter', op: 'panic' },
  4: { stim: 'swatter', op: 'panic' },
};

/** Where a visit opens the onboarding: `?onb=` wins; a snap, a link to an experiment, a past visit = off. */
export function startOnb(o: {
  params: { snap: boolean; onb?: OnbStep; exp?: Pair };
  done: boolean;
  /** Results from before (e.g. Phase 8 puzzles): not a first visit. */
  journal: boolean;
}): OnbStep {
  const { params, done, journal } = o;
  if (params.onb !== undefined) return params.onb;
  return params.snap || params.exp || done || journal ? 0 : 1;
}

export interface OnbMemory {
  done(): boolean;
  save(): void;
}

const KEY = 'fly_ui.onboarded';

/** localStorage-backed; missing / throwing storage = not onboarded, not remembered. */
export const onbMemory: OnbMemory = {
  done() {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  },
  save() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // not remembered: fine
    }
  },
};

/** The first-visit walk through one experiment, told in the card; it drives `trial`'s slots. */
export class OnboardingStore {
  step: OnbStep = 0;

  constructor(
    private readonly trial: TrialStore,
    private readonly memory: OnbMemory = onbMemory,
  ) {
    makeAutoObservable<this, 'trial' | 'memory'>(this, { trial: false, memory: false });
  }

  /** Opens at `step` with its pair in the slots (steps 1 and 3 ask for a bet). */
  begin(step: OnbStep): void {
    this.step = step;
    if (step === 0) return;
    const { stim, op } = PAIRS[step];
    this.trial.setStim(stim);
    this.trial.setOp(op);
    this.trial.fresh();
    this.trial.setTab('exp');
    this.trial.setAsk(step === 1 || step === 3);
  }

  /** «?»: the steps again. */
  restart(): void {
    this.begin(1);
  }

  /** Step 2's pill «Выключить нейрон бегства». */
  next(): void {
    if (this.step === 2) this.begin(3);
  }

  /** Step 4's «понятно». */
  finish(): void {
    this.end();
  }

  /** «пропустить»: an empty setup. */
  skip(): void {
    this.end();
    this.trial.setAsk(false);
    this.trial.setStim(null);
    this.trial.setOp('none');
  }

  /** Follows the card: a result moves 1 → 2 and 3 → 4; another pair in the slots ends the walk. */
  attach(): () => void {
    const results = reaction(
      () => this.trial.outcome,
      (o) => {
        if (!o) return;
        const id = pairId(o.pair);
        if (this.step === 1 && id === pairId(PAIRS[1])) this.step = 2;
        else if (this.step === 3 && id === pairId(PAIRS[3])) this.step = 4;
      },
    );
    const slots = reaction(
      () => (this.trial.pair ? pairId(this.trial.pair) : null),
      (id) => {
        if (this.step !== 0 && id !== pairId(PAIRS[this.step])) {
          this.end();
          this.trial.setAsk(false);
        }
      },
    );
    return () => {
      results();
      slots();
    };
  }

  private end(): void {
    this.step = 0;
    this.memory.save();
  }
}

export const onboarding = new OnboardingStore(trial);
