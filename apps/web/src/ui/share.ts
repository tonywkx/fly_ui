import { observable, runInAction } from 'mobx';
import { data } from '@/data/store';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { encodeExperiment, shareSearch } from '@/state/share';

/** Outcome of the last Share, shown on the button for a moment (null = idle). */
export const shareNote = observable.box<'copied' | 'address' | null>(null);
const NOTE_MS = 1800;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Scenario rows → bodyIds (none before the scenario's meta is in). */
function bodyIds(rows: Iterable<number | null>): number[] {
  const meta = data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  return [...rows].flatMap((r) => (r === null || !meta ? [] : [meta.bodyIds[r] as number]));
}

/** Stimuli + silencing + drive as the `?x=` code; undefined when the circuit is untouched. */
export function experimentCode(): string | undefined {
  return experiment.touched
    ? encodeExperiment({
        stimulated: bodyIds(experiment.stimulated),
        silenced: bodyIds(experiment.silenced),
        stim: experiment.stim,
      })
    : undefined;
}

/** The current experiment as a link: scenario, stimuli + silencing + drive (`x`), electrodes, colour mode. */
export function experimentLink(): string {
  const search = shareSearch({
    scenario: data.scenario ?? undefined,
    x: experimentCode(),
    probes: bodyIds(experiment.probes),
    color: app.colorBy === 'nt' ? undefined : app.colorBy,
  });
  return `${location.origin}${location.pathname}${search}`;
}

/** Puts the link in the address bar and copies it; the note says which of the two worked. */
export async function shareExperiment() {
  const url = experimentLink();
  history.replaceState(history.state, '', url);
  let note: 'copied' | 'address' = 'copied';
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    note = 'address';
  }
  clearTimeout(timer);
  runInAction(() => shareNote.set(note));
  timer = setTimeout(() => runInAction(() => shareNote.set(null)), NOTE_MS);
}
