import type { ItemKind } from '@fly/sim';
import { COLOR_BY, type ColorBy, isColorBy } from '../data/colorBy';
import { isLang, LANGS, type Lang } from '../i18n';
import { type Pair, parsePair } from '../scene/dish/discoveries';
import { PULLS, type Pull } from '../scene/dish/loop';
import { OPS, type Op } from '../scene/dish/verdict';
import { isQuality, QUALITIES, type Quality } from '../scene/quality';
import { MAX_PROBES, TOOL_KEYS, type Tool } from './experiment';
import type { OnbStep } from './onboarding';
import { decodeExperiment, type SharedExperiment } from './share';
import type { TourStep } from './tour';
import type { CardTab } from './trial';
import type { WelcomeMode } from './welcome';

/** Colour modes (2.6) + layer isolation: `cloud` / `shells` show only that background layer. */
export const DEBUG_MODES = [
  'soma-dist',
  'id',
  'nt',
  'region',
  'cloud',
  'shells',
  'neurons',
  // the dish: the hologram label held shown, its decision flash held at the peak
  'holo-label',
  'holo-flare',
] as const;
export type DebugMode = (typeof DEBUG_MODES)[number];

/** App state encoded in the URL (also what `pnpm snap --k=v` sets). */
export interface Params {
  /** Scenario id; checked against the manifest once it loads. */
  scenario?: string;
  /** Simulation time to show, ms. */
  t?: number;
  debug?: DebugMode;
  /** Neuron tint (colour mode); transmitter when absent. */
  color?: ColorBy;
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
  /** Shared experiment (stimuli, silencing, drive) — `?x=<base64url>`, see `state/share.ts`. */
  experiment?: SharedExperiment;
  /** Brain view: the tool in hand at start (the dish's «любой нейрон в мозге» comes with `silence`). */
  tool?: Tool;
  /** Start with the director camera following the activity front. */
  director?: true;
  /** Interface language; overrides the stored choice (scripts pin `en`). */
  lang?: Lang;
  /** The page: the Terrarium (home) or the brain (`?view=brain`, or any old brain link, see `BRAIN_KEYS`). */
  view: 'dish' | 'brain';
  /** Arrived by the fly ↔ neuron zoom from this view: the page opens with the second half of the flight. */
  from?: 'dish' | 'brain';
  /** Freeze the dish's zoom flight at this many ms (snaps; with `from=brain` the way out, else the way in). */
  zoom?: number;
  /** Dish items at mm positions (`kind@x,y;…`) — snaps and debugging until the palette (8.6). */
  items?: { kind: ItemKind; x: number; y: number }[];
  /** Dish operations switched on at start (`panic,moon,…`). */
  ops?: Op[];
  /** Dish: puppet keys held (snaps). */
  puppet?: Pull[];
  /** Dish: open the run's replay paused at this sim ms once it ends (snaps, with `run`). */
  replay?: number;
  /** Dish: the experiment card's slots (`stim[:op]`, e.g. `swatter:panic`). */
  exp?: Pair;
  /** Dish: run that experiment once the live brain is up (snaps). */
  run?: true;
  /** Dish, phone: open the sheet on «Положить» (snaps; the card's tabs are `tab`). */
  sheet?: 'put';
  /** Dish: the experiment card's tab (`found` = «Открытия»). */
  tab?: CardTab;
  /** First-visit tour: 0 = off, 1..4 = open at that step (see `state/tour.ts`). */
  tour?: TourStep;
  /** Dish, first visit: 0 = off, 1..4 = the onboarding at that step (snaps, see `state/onboarding.ts`). */
  onb?: OnbStep;
  /** Dish: the welcome (`?welcome=full|short|0`, see `state/welcome.ts`). */
  welcome?: WelcomeMode;
}

/** Keys only the brain reads: a link without `view` that has one is an old brain link (the bare page was the brain). */
const BRAIN_KEYS = [
  'scenario',
  'x',
  'tour',
  'select',
  'probes',
  'trace',
  'pick',
  'director',
  'intro',
  'sim',
  'debug',
  'color',
  'ui',
];
/** Keys the dish shares with the brain: these values are the dish's own (`?ui=ops:panic`, `?debug=holo-flare`). */
const DISH_VALUES: Record<string, (v: string) => boolean> = {
  debug: (v) => v.startsWith('holo-'),
  ui: (v) => v === 'ops' || v.startsWith('ops:'),
};
const brainKey = (q: URLSearchParams, k: string) => q.has(k) && !DISH_VALUES[k]?.(q.get(k) ?? '');

const ITEM_KINDS: readonly ItemKind[] = ['sugar', 'bitter', 'odor', 'female'];

const flag = (v: string | null) => v !== null && v !== '0' && v !== 'false';

/** Pure: never throws, invalid values are dropped and reported in `warnings`. */
export function parseParams(search: string): { params: Params; warnings: string[] } {
  const q = new URLSearchParams(search);
  const warnings: string[] = [];
  const view = q.get('view');
  if (view !== null && view !== 'dish' && view !== 'brain')
    warnings.push(`view: expected "dish" | "brain", got "${view}"`);
  const brain =
    view === 'brain' ||
    (view !== 'dish' && (q.get('from') === 'dish' || BRAIN_KEYS.some((k) => brainKey(q, k))));
  const params: Params = {
    stats: flag(q.get('stats')),
    snap: flag(q.get('snap')),
    view: brain ? 'brain' : 'dish',
  };
  if (flag(q.get('director'))) params.director = true;

  const scenario = q.get('scenario');
  if (scenario !== null) {
    if (/^[a-z0-9_-]+$/i.test(scenario)) params.scenario = scenario;
    else warnings.push(`scenario: invalid id "${scenario}"`);
  }

  const ms = (key: 't' | 'intro' | 'zoom' | 'replay') => {
    const v = q.get(key);
    if (v === null) return;
    const n = Number(v);
    if (v !== '' && Number.isFinite(n) && n >= 0) params[key] = n;
    else warnings.push(`${key}: expected ms ≥ 0, got "${v}"`);
  };
  ms('t');
  ms('intro');
  ms('zoom');
  ms('replay');

  const exp = q.get('exp');
  if (exp !== null) {
    const p = parsePair(exp);
    if (p) params.exp = p;
    else warnings.push(`exp: expected stim[:op] from the card, got "${exp}"`);
  }
  if (flag(q.get('run'))) params.run = true;

  const tab = q.get('tab');
  if (tab !== null) {
    if (tab === 'exp' || tab === 'found') params.tab = tab;
    else warnings.push(`tab: unknown card tab "${tab}" (exp | found)`);
  }

  const sheet = q.get('sheet');
  if (sheet !== null) {
    if (sheet === 'put') params.sheet = sheet;
    else warnings.push(`sheet: unknown tab "${sheet}" (put; exp | found are \`tab\`)`);
  }

  const debug = q.get('debug');
  if (debug !== null) {
    if ((DEBUG_MODES as readonly string[]).includes(debug)) params.debug = debug as DebugMode;
    else warnings.push(`debug: unknown mode "${debug}" (${DEBUG_MODES.join(' | ')})`);
  }

  const color = q.get('color');
  if (color !== null) {
    if (isColorBy(color)) params.color = color;
    else warnings.push(`color: unknown mode "${color}" (${COLOR_BY.join(' | ')})`);
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

  const lang = q.get('lang');
  if (lang !== null) {
    if (isLang(lang)) params.lang = lang;
    else warnings.push(`lang: expected ${LANGS.map((l) => `"${l}"`).join(' | ')}, got "${lang}"`);
  }

  const tour = q.get('tour');
  if (tour !== null) {
    if (/^[0-4]$/.test(tour)) params.tour = Number(tour) as TourStep;
    else warnings.push(`tour: expected 0..4, got "${tour}"`);
  }

  const onb = q.get('onb');
  if (onb !== null) {
    if (/^[0-4]$/.test(onb)) params.onb = Number(onb) as OnbStep;
    else warnings.push(`onb: expected 0..4, got "${onb}"`);
  }

  const welcome = q.get('welcome');
  if (welcome !== null) {
    if (welcome === 'full' || welcome === 'short') params.welcome = welcome;
    else if (welcome === '0') params.welcome = 'off';
    else warnings.push(`welcome: expected "full" | "short" | "0", got "${welcome}"`);
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

  const x = q.get('x');
  if (x !== null) {
    const e = decodeExperiment(x);
    if (e) params.experiment = e;
    else warnings.push(`x: not a shared experiment code "${x}"`);
  }

  const from = q.get('from');
  if (from !== null) {
    if (from === 'dish' || from === 'brain') params.from = from;
    else warnings.push(`from: expected "dish" | "brain", got "${from}"`);
  }

  const items = q.get('items');
  if (items !== null) {
    const list = items.split(';').map((v) => {
      const m = /^([a-z]+)@(-?[\d.]+),(-?[\d.]+)$/.exec(v.trim());
      const kind = m?.[1] as ItemKind;
      const [x, y] = [Number(m?.[2]), Number(m?.[3])];
      return m && ITEM_KINDS.includes(kind) && Number.isFinite(x) && Number.isFinite(y)
        ? { kind, x, y }
        : null;
    });
    if (list.every((v): v is NonNullable<typeof v> => v !== null)) params.items = list;
    else warnings.push(`items: expected "kind@x,y;…" (${ITEM_KINDS.join(' | ')}), got "${items}"`);
  }

  const ops = q.get('ops');
  if (ops !== null) {
    const list = ops.split(',').map((v) => v.trim());
    if (list.every((v): v is Op => (OPS as readonly string[]).includes(v))) params.ops = list;
    else warnings.push(`ops: expected a list of ${OPS.join(' | ')}, got "${ops}"`);
  }
  const puppet = q.get('puppet');
  if (puppet !== null) {
    const list = puppet.split(',').map((v) => v.trim());
    if (list.every((v): v is Pull => (PULLS as readonly string[]).includes(v))) params.puppet = list;
    else warnings.push(`puppet: expected a list of ${PULLS.join(' | ')}, got "${puppet}"`);
  }

  const tool = q.get('tool');
  if (tool !== null) {
    if (Object.hasOwn(TOOL_KEYS, tool)) params.tool = tool as Tool;
    else warnings.push(`tool: expected ${Object.keys(TOOL_KEYS).join(' | ')}, got "${tool}"`);
  }

  // one value per op slot (SURGEON-SHAPE §Flow): the brain's cells win, as on the way back from it
  if (params.experiment && (params.ops || (params.exp && params.exp.op !== 'none'))) {
    warnings.push('ops / exp: the op is dropped, `x` brain picks hold the slot');
    params.ops = undefined;
    if (params.exp) params.exp = { ...params.exp, op: 'none' };
  }

  return { params, warnings };
}
