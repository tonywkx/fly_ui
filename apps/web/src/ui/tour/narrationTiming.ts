/** Loading narration (docs/TOUR.md §0): lines over the assembling dust, one every `LINE_MS`. */
export const NARRATION_LINES = 3;
export const LINE_MS = 2500;

export interface NarrationState {
  /** Line shown, 0-based. */
  line: number;
  /** Every line has been read and the data is ready: on to step 1. */
  done: boolean;
  /** When the state next changes on its own (ms since the start); none once the last line is read. */
  nextMs?: number;
}

/** State `elapsed` ms after the narration started; the last line holds until `ready`. */
export function narrationAt(elapsed: number, ready: boolean): NarrationState {
  const line = Math.min(Math.floor(Math.max(elapsed, 0) / LINE_MS), NARRATION_LINES - 1);
  const read = elapsed >= NARRATION_LINES * LINE_MS;
  return {
    line,
    done: read && ready,
    nextMs: read ? undefined : Math.min(line + 1, NARRATION_LINES) * LINE_MS,
  };
}
