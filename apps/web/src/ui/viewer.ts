import { tOr } from '../i18n';

/** Scenario name for the HUD: `title` under the logo, `short` in the phone ViewerBar; `fallback` for unknown ids. */
export const scenarioTitle = (id: string, form: 'title' | 'short', fallback = id) =>
  tOr(`scenario.${id}.${form}`, fallback);

/** URL params that describe how to view, not what was being done: they survive a scenario switch. */
const KEEP = ['quality', 'gl', 'stats', 'director', 'lang'];

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
