import { makeAutoObservable, observable } from 'mobx';
import { type ColorBy, nextColorBy } from '@/data/colorBy';
import type { Backend } from '@/scene/engine';
import type { IntroPhase } from '@/scene/intro';
import { type Device, defaultQuality, type Quality } from '@/scene/quality';
import { type Params, parseParams } from './params';

/** Things that must finish before a snap is taken. */
export type ReadyFlag =
  | 'fonts'
  | 'data'
  | 'frame'
  | 'dust'
  | 'sim'
  | 'pick'
  | 'trace'
  | 'flycam'
  | 'captions';

export class AppStore {
  readonly params: Params;
  readonly warnings: readonly string[];
  reducedMotion = false;
  /** Renderer backend once initialized. */
  backend: Backend | null = null;
  /** Set by the scene at phase boundaries only (never per frame). */
  introPhase: IntroPhase = 'assemble';
  hint = false;
  hintDismissed = false;
  /** Render preset: from the URL, else from the device; `FpsGuard` may step it down. */
  quality: Quality;
  /** Fixed by `?quality=` or a snap (always high unless asked): no device default, no auto step-down. */
  readonly qualityPinned: boolean;
  /** Outstanding readiness flags; `ready` once empty. */
  readonly pending = observable.set<ReadyFlag>();
  /** Scenario graph row under the pointer (set on change only). */
  hover: number | null = null;
  /** What the neurons are tinted by. */
  colorBy: ColorBy;
  /** Director camera: follows the activity front until the user takes the camera. */
  director: boolean;
  /** Audio monitor (spike clicks + song); off until the user turns it on (autoplay policy). */
  sound = false;
  /** Scenario narration under the timeline. */
  captions = true;

  constructor(search: string) {
    ({ params: this.params, warnings: this.warnings } = parseParams(search));
    this.qualityPinned = !!this.params.quality || this.params.snap;
    // before init the backend is a guess: WebGPU if exposed and not forced off
    const guess = this.params.gl || !('gpu' in navigator) ? 'webgl2' : 'webgpu';
    this.colorBy = this.params.color ?? 'nt';
    this.director = !!this.params.director;
    this.quality = this.params.quality ?? (this.params.snap ? 'high' : defaultQuality(device(guess)));
    makeAutoObservable(this, { params: false, warnings: false, pending: false });
  }

  get ready() {
    return this.pending.size === 0;
  }

  /** Register a flag that must be marked ready before the app counts as rendered. */
  waitFor(flag: ReadyFlag) {
    this.pending.add(flag);
  }

  markReady(flag: ReadyFlag) {
    this.pending.delete(flag);
  }

  setReducedMotion(v: boolean) {
    this.reducedMotion = v;
  }

  setIntro(phase: IntroPhase, hint: boolean) {
    this.introPhase = phase;
    this.hint = hint;
  }

  dismissHint() {
    this.hintDismissed = true;
  }

  get hintVisible() {
    return this.hint && !this.hintDismissed;
  }

  setBackend(b: Backend) {
    this.backend = b;
    if (!this.qualityPinned) this.quality = defaultQuality(device(b));
  }

  setQuality(q: Quality) {
    this.quality = q;
  }

  setHover(row: number | null) {
    this.hover = row;
  }

  setColorBy(m: ColorBy) {
    this.colorBy = m;
  }

  setDirector(on: boolean) {
    this.director = on;
  }

  toggleDirector() {
    this.director = !this.director;
  }

  setSound(on: boolean) {
    this.sound = on;
  }

  toggleCaptions() {
    this.captions = !this.captions;
  }

  cycleColorBy() {
    this.colorBy = nextColorBy(this.colorBy);
  }
}

function device(backend: Backend): Device {
  return {
    backend,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    cores: navigator.hardwareConcurrency || 4,
  };
}

export const app = new AppStore(window.location.search);
