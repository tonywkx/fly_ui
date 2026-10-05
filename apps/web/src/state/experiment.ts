import { makeAutoObservable, observable, observableRef } from 'mobx';
import { hotkey } from '../lib/keys';

/** Live sim as the inspector sees it: not started, loading the full graph, or running. */
export type LiveStatus = 'off' | 'loading' | 'on' | 'failed';

/** What a click on a neuron does. */
export type Tool = 'select' | 'stimulate' | 'silence' | 'electrode' | 'trace';

export const TOOL_KEYS: Record<Tool, string> = {
  select: 'V',
  stimulate: 'S',
  silence: 'X',
  electrode: 'E',
  trace: 'T',
};

/** Electrode slots (one oscilloscope each, 4.5). */
export const MAX_PROBES = 4;

/** Slider ranges for the user's stimulus: Poisson rate (Hz) and kick gain (× the scenario kick). */
export const STIM_RANGE = { hz: [10, 400], gain: [0.25, 3] } as const;

export interface Stimulus {
  hz: number;
  gain: number;
}

/** What the user did to the circuit (scenario rows). Shared as `?x=` by bodyId (`state/share.ts`). */
export class ExperimentStore {
  /** Scenario row open in the inspector. */
  selected: number | null = null;
  readonly stimulated = observable.set<number>();
  readonly silenced = observable.set<number>();
  live: LiveStatus = 'off';
  /** Fetch the live sim ahead of need (the tour, before "now break it"); baked keeps playing. */
  warm = false;
  /** Latest fly-to request (the scene reacts to a new object, even for the same row). */
  fly: { row: number } | null = null;
  /** Latest neuron clicked with the Trace tool (the scene turns it into a tracer end). */
  tracePick: { row: number } | null = null;
  tool: Tool = 'select';
  /** Drive applied to every stimulated row. */
  stim: Stimulus = { hz: 150, gain: 1 };
  /** Electrode rows by slot; a slot keeps its colour while the others come and go. */
  probes: (number | null)[] = Array(MAX_PROBES).fill(null);

  constructor() {
    makeAutoObservable(this, {
      stimulated: false,
      silenced: false,
      fly: observableRef,
      tracePick: observableRef,
    });
  }

  /** Stimulus or silencing present (needs the live sim). */
  get touched() {
    return this.stimulated.size > 0 || this.silenced.size > 0;
  }

  get probesFull() {
    return !this.probes.includes(null);
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

  /** Replaces stimuli, silencing and drive (a shared link opening). */
  load(stimulated: number[], silenced: number[], stim: Stimulus) {
    this.clear();
    for (const r of stimulated) this.stimulated.add(r);
    for (const r of silenced) this.silenced.add(r);
    this.setStim(stim);
  }

  flyTo(row: number) {
    this.fly = { row };
  }

  warmLive() {
    this.warm = true;
  }

  setLive(s: LiveStatus) {
    this.live = s;
  }

  setTool(t: Tool) {
    this.tool = t;
  }

  setStim(s: Partial<Stimulus>) {
    const { hz = this.stim.hz, gain = this.stim.gain } = s;
    this.stim = { hz: clamp(hz, STIM_RANGE.hz), gain: clamp(gain, STIM_RANGE.gain) };
  }

  /** Adds or removes an electrode; false when all slots are taken. */
  toggleProbe(row: number): boolean {
    const at = this.probes.indexOf(row);
    if (at >= 0) {
      this.probes[at] = null;
      return true;
    }
    const free = this.probes.indexOf(null);
    if (free < 0) return false;
    this.probes[free] = row;
    return true;
  }

  removeProbe(slot: number) {
    this.probes[slot] = null;
  }

  /** Click with the active tool (`null` = empty space); false if it could not be applied. */
  apply(row: number | null): boolean {
    if (this.tool === 'select') this.select(row);
    else if (row === null) return false;
    else if (this.tool === 'stimulate') this.toggleStim(row);
    else if (this.tool === 'silence') this.toggleSilence(row);
    else if (this.tool === 'trace') this.tracePick = { row };
    else return this.toggleProbe(row);
    return true;
  }

  /** Brush stroke over `row`: adds with Stimulate / Silence, never removes. */
  paint(row: number) {
    if (this.tool === 'stimulate') this.stimulated.add(row);
    else if (this.tool === 'silence') this.silenced.add(row);
  }

  /** Esc: back to Select first, then drop the selection; false if there was nothing to undo. */
  escape(): boolean {
    if (this.tool !== 'select') this.tool = 'select';
    else if (this.selected !== null) this.selected = null;
    else return false;
    return true;
  }
}

/** C cycles the colour mode. */
export type KeyAction = Tool | 'escape' | 'color';

const BY_KEY = Object.fromEntries(
  Object.entries(TOOL_KEYS).map(([t, k]) => [k.toLowerCase(), t as Tool]),
) as Record<string, Tool>;

/** Global hotkey for a key press, or null (modified, auto-repeat, unbound). */
export function keyAction(e: KeyboardEvent): KeyAction | null {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return null;
  const k = hotkey(e);
  if (k === 'Escape') return 'escape';
  if (k === 'c') return 'color';
  return BY_KEY[k] ?? null;
}

/** ⌘K / Ctrl+K: the command palette (works while typing too). */
export function paletteKey(e: KeyboardEvent): boolean {
  return !!(e.metaKey || e.ctrlKey) && !e.altKey && hotkey(e) === 'k';
}

function toggle(set: Set<number>, row: number) {
  if (set.has(row)) set.delete(row);
  else set.add(row);
}

function clamp(v: number, [lo, hi]: readonly [number, number]) {
  return Math.min(hi, Math.max(lo, v));
}

export const experiment = new ExperimentStore();
