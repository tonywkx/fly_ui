import { isQuality, QUALITIES, type Quality } from '../scene/quality';

/** Colour modes (2.6) + layer isolation: `cloud` / `shells` show only that background layer. */
export const DEBUG_MODES = ['soma-dist', 'id', 'nt', 'region', 'cloud', 'shells', 'neurons'] as const;
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
  /** Freeze the intro clock at this many ms (snaps of the intro); data counts as ready. */
  intro?: number;
  /** Force the WebGL2 backend (fallback check); WebGPU is used when available otherwise. */
  gl?: 'webgl2';
  /** Render preset; picked from the device (and stepped down on slow frames) when absent. */
  quality?: Quality;
  /** Activity source: the baked spike train (default) or the live full-graph sim in a Worker. */
  sim?: 'baked' | 'live';
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

  const ms = (key: 't' | 'intro') => {
    const v = q.get(key);
    if (v === null) return;
    const n = Number(v);
    if (v !== '' && Number.isFinite(n) && n >= 0) params[key] = n;
    else warnings.push(`${key}: expected ms ≥ 0, got "${v}"`);
  };
  ms('t');
  ms('intro');

  const debug = q.get('debug');
  if (debug !== null) {
    if ((DEBUG_MODES as readonly string[]).includes(debug)) params.debug = debug as DebugMode;
    else warnings.push(`debug: unknown mode "${debug}" (${DEBUG_MODES.join(' | ')})`);
  }

  const ui = q.get('ui');
  if (ui) params.ui = ui;

  const gl = q.get('gl');
  if (gl !== null) {
    if (gl === 'webgl2') params.gl = gl;
    else warnings.push(`gl: expected "webgl2", got "${gl}"`);
  }

  const quality = q.get('quality');
  if (quality !== null) {
    if (isQuality(quality)) params.quality = quality;
    else warnings.push(`quality: unknown preset "${quality}" (${QUALITIES.join(' | ')})`);
  }

  const sim = q.get('sim');
  if (sim !== null) {
    if (sim === 'baked' || sim === 'live') params.sim = sim;
    else warnings.push(`sim: expected "baked" | "live", got "${sim}"`);
  }

  return { params, warnings };
}
