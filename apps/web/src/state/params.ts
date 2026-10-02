/** Debug colour modes for the scene (rendered in 2.6). */
export const DEBUG_MODES = ['soma-dist', 'id', 'nt', 'region'] as const;
export type DebugMode = (typeof DEBUG_MODES)[number];

/** App state encoded in the URL (also what `pnpm snap --k=v` sets). */
export interface Params {
  /** Scenario id; checked against the manifest once it loads. */
  scenario?: string;
  /** Simulation time to show, ms. */
  t?: number;
  debug?: DebugMode;
  /** Show the fps/ms overlay. */
  stats: boolean;
  /** Set by scripts/snap.ts: skip intro motion, report readiness via `window.__snapReady`. */
  snap: boolean;
  /** UI state preset for snaps (panels open etc.), interpreted by the UI. */
  ui?: string;
}

const flag = (v: string | null) => v !== null && v !== '0' && v !== 'false';

/** Pure: never throws, invalid values are dropped and reported in `warnings`. */
export function parseParams(search: string): { params: Params; warnings: string[] } {
  const q = new URLSearchParams(search);
  const params: Params = { stats: flag(q.get('stats')), snap: flag(q.get('snap')) };
  const warnings: string[] = [];

  const scenario = q.get('scenario');
  if (scenario !== null) {
    if (/^[a-z0-9_-]+$/i.test(scenario)) params.scenario = scenario;
    else warnings.push(`scenario: invalid id "${scenario}"`);
  }

  const t = q.get('t');
  if (t !== null) {
    const n = Number(t);
    if (t !== '' && Number.isFinite(n) && n >= 0) params.t = n;
    else warnings.push(`t: expected ms ≥ 0, got "${t}"`);
  }

  const debug = q.get('debug');
  if (debug !== null) {
    if ((DEBUG_MODES as readonly string[]).includes(debug)) params.debug = debug as DebugMode;
    else warnings.push(`debug: unknown mode "${debug}" (${DEBUG_MODES.join(' | ')})`);
  }

  const ui = q.get('ui');
  if (ui) params.ui = ui;

  return { params, warnings };
}
