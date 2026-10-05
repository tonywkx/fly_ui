import { describe, expect, it } from 'vitest';
import { LINE_MS, NARRATION_LINES, narrationAt } from './narrationTiming';

describe('narrationAt', () => {
  it('shows one line per LINE_MS', () => {
    expect(narrationAt(0, false).line).toBe(0);
    expect(narrationAt(LINE_MS - 1, false).line).toBe(0);
    expect(narrationAt(LINE_MS, false).line).toBe(1);
    expect(narrationAt(2 * LINE_MS, false).line).toBe(2);
  });

  it('holds the last line until the data is ready', () => {
    const late = 10 * LINE_MS;
    expect(narrationAt(late, false)).toMatchObject({ line: NARRATION_LINES - 1, done: false });
    expect(narrationAt(late, true)).toMatchObject({ line: NARRATION_LINES - 1, done: true });
  });

  it('reads every line in full even when ready early', () => {
    const lastEnds = NARRATION_LINES * LINE_MS;
    expect(narrationAt(LINE_MS, true).done).toBe(false);
    expect(narrationAt(lastEnds - 1, true).done).toBe(false);
    expect(narrationAt(lastEnds, true).done).toBe(true);
  });

  it('next boundary is the next line, then the end of the last one', () => {
    expect(narrationAt(100, false).nextMs).toBe(LINE_MS);
    expect(narrationAt(2 * LINE_MS + 5, false).nextMs).toBe(3 * LINE_MS);
    expect(narrationAt(3 * LINE_MS, false).nextMs).toBeUndefined();
  });
});
