import { makeAutoObservable, observable } from 'mobx';
import { type Params, parseParams } from './params';

/** Things that must finish before a snap is taken. 2.2 adds `data` / `frame`. */
export type ReadyFlag = 'fonts' | 'data' | 'frame';

export class AppStore {
  readonly params: Params;
  readonly warnings: readonly string[];
  reducedMotion = false;
  /** Outstanding readiness flags; `ready` once empty. */
  readonly pending = observable.set<ReadyFlag>();

  constructor(search: string) {
    ({ params: this.params, warnings: this.warnings } = parseParams(search));
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
}

export const app = new AppStore(window.location.search);
