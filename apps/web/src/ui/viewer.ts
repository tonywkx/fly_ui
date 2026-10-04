/** Scenario names for the HUD: [title under the logo, label in the phone ViewerBar]. */
export const SCENARIO_TITLES: Record<string, readonly [string, string]> = {
  escape: ['Escape', 'Escape'],
  sugar: ['Sugar', 'Sugar'],
  song: ['Courtship song', 'Song'],
};

/** URL params that describe how to view, not what was being done: they survive a scenario switch. */
const KEEP = ['quality', 'gl', 'stats', 'director'];

/** `?scenario=<id>` plus the current view settings; experiment, time and selection start fresh. */
export function scenarioHref(search: string, id: string): string {
  const from = new URLSearchParams(search);
  const to = new URLSearchParams({ scenario: id });
  for (const k of KEEP) {
    const v = from.get(k);
    if (v !== null) to.set(k, v);
  }
  return `?${to}`;
}
