import { makeAutoObservable } from 'mobx';
import type { Pair } from '../scene/dish/discoveries';
import { onboarding } from './onboarding';

/** WELCOME-SHAPE §Flow: the full screen (first visit, «?»), the short splash (returning), or none. */
export type WelcomeMode = 'full' | 'short' | 'off';

/** What a visit opens with: `?welcome=` wins; a snap, a link to an experiment, the brain = off. */
export function startWelcome(o: {
  params: {
    snap: boolean;
    view: 'dish' | 'brain';
    from?: 'dish' | 'brain';
    exp?: Pair;
    welcome?: WelcomeMode;
  };
  welcomed: boolean;
}): WelcomeMode {
  const { params } = o;
  if (params.welcome !== undefined) return params.welcome;
  if (params.snap || params.exp || params.from === 'brain' || params.view === 'brain') return 'off';
  return o.welcomed ? 'short' : 'full';
}

/** The progress line's number: integer %, held at 99 until the brain is up; null = total unknown. */
export function loadPct(loading: number | null, ready: boolean): number | 'ready' | null {
  if (ready) return 'ready';
  if (loading === null) return null;
  return Math.min(99, Math.max(0, Math.floor(loading * 100)));
}

export interface WelcomeMemory {
  welcomed(): boolean;
  save(): void;
}

const KEY = 'fly_ui.welcomed';

/** localStorage-backed; missing / throwing storage = a first visit every time. */
export const welcomeMemory: WelcomeMemory = {
  welcomed() {
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

/** The welcome over the dish; onboarding waits for `mode === 'off'`. */
export class WelcomeStore {
  mode: WelcomeMode = 'off';
  /** Reopened by «?» (not the visit's own welcome): «Начать» walks the onboarding again. */
  again = false;

  constructor(
    private readonly onb: { restart(): void },
    private readonly memory: WelcomeMemory = welcomeMemory,
  ) {
    makeAutoObservable<this, 'onb' | 'memory'>(this, { onb: false, memory: false });
  }

  open(mode: WelcomeMode): void {
    this.mode = mode;
    this.again = false;
  }

  /** «?» in the wordmark row. */
  reopen(): void {
    this.mode = 'full';
    this.again = true;
  }

  /** «Начать». */
  start(): void {
    const again = this.again;
    this.close();
    if (again) this.onb.restart();
  }

  /** Esc, or the short splash leaving; the full one is remembered as seen. */
  close(): void {
    if (this.mode === 'full') this.memory.save();
    this.mode = 'off';
    this.again = false;
  }
}

export const welcome = new WelcomeStore(onboarding);
