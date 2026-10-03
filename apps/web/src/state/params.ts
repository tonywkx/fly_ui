import { isQuality, QUALITIES, type Quality } from '../scene/quality';
import { MAX_PROBES } from './experiment';

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
  /** Hover-pick at this viewport point (fractions 0..1, x right, y down) — snaps of the tooltip. */
  pick?: [number, number];
  /** Open the inspector on this bodyId (scenario neuron) — snaps of the focus look. */
  select?: number;
  /** Electrodes on these bodyIds (≤ 4, slot order) — snaps of the oscilloscopes. */
  probes?: number[];
  /** Signal tracer ends `FROM>TO`, optionally `>i` (path index) — snaps of the trace look. */
  trace?: { from: string; to: string; path: number };
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

  const pick = q.get('pick');
  if (pick !== null) {
    const xy = pick.split(',').map((v) => (v.trim() === '' ? Number.NaN : Number(v)));
    if (xy.length === 2 && xy.every((n) => n >= 0 && n <= 1)) params.pick = xy as [number, number];
    else warnings.push(`pick: expected "x,y" in 0..1, got "${pick}"`);
  }

  const select = q.get('select');
  if (select !== null) {
    const id = Number(select);
    if (/^\d+$/.test(select) && Number.isSafeInteger(id)) params.select = id;
    else warnings.push(`select: expected a bodyId, got "${select}"`);
  }

  const probes = q.get('probes');
  if (probes !== null) {
    const ids = probes.split(',').map((v) => v.trim());
    if (ids.length <= MAX_PROBES && ids.every((v) => /^\d+$/.test(v) && Number.isSafeInteger(Number(v))))
      params.probes = ids.map(Number);
    else warnings.push(`probes: expected up to ${MAX_PROBES} comma-separated bodyIds, got "${probes}"`);
  }

  const trace = q.get('trace');
  if (trace !== null) {
    const [from, to, i = '0', ...rest] = trace.split('>').map((v) => v.trim());
    if (from && to && rest.length === 0 && /^\d$/.test(i)) params.trace = { from, to, path: Number(i) };
    else warnings.push(`trace: expected "FROM>TO[>i]", got "${trace}"`);
  }

  return { params, warnings };
}
