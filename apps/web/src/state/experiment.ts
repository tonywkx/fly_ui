import { makeAutoObservable, observable, observableRef } from 'mobx';

/** Live sim as the inspector sees it: not started, loading the full graph, or running. */
export type LiveStatus = 'off' | 'loading' | 'on' | 'failed';

/** What the user did to the circuit (scenario rows). Encoded in the URL later (4.7). */
export class ExperimentStore {
  /** Scenario row open in the inspector. */
  selected: number | null = null;
  readonly stimulated = observable.set<number>();
  readonly silenced = observable.set<number>();
  live: LiveStatus = 'off';
  /** Latest fly-to request (the scene reacts to a new object, even for the same row). */
  fly: { row: number } | null = null;

  constructor() {
    makeAutoObservable(this, { stimulated: false, silenced: false, fly: observableRef });
  }

  /** Stimulus or silencing present (needs the live sim). */
  get touched() {
    return this.stimulated.size > 0 || this.silenced.size > 0;
  }

  select(row: number | null) {
    this.selected = row;
  }

  toggleStim(row: number) {
    toggle(this.stimulated, row);
  }

  toggleSilence(row: number) {
    toggle(this.silenced, row);
  }

  clear() {
    this.stimulated.clear();
    this.silenced.clear();
  }

  flyTo(row: number) {
    this.fly = { row };
  }

  setLive(s: LiveStatus) {
    this.live = s;
  }
}

function toggle(set: Set<number>, row: number) {
  if (set.has(row)) set.delete(row);
  else set.add(row);
}

export const experiment = new ExperimentStore();
