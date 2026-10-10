import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Action,
  COMMANDS,
  type Command,
  CommandMeter,
  createSim,
  type Decision,
  decide,
  delivery,
  diffDrive,
  mulberry32,
  OPERATIONS,
  PATHS,
  resolveGroups,
  SENSE_HZ,
  SENSES,
  type Senses,
  STIMULI,
  type Stimulus,
  senseDrive,
  World,
  type WorldEvent,
} from '@fly/sim';
import { loadGraphCache } from '../fetch/graph';
import { buildGraph, orderNeurons, toRecord } from '../process/graph';
import { buildNet } from '../process/spikes';

// 9.2 norm table: every scripted stimulus × brain state, world + sim headless (1 ms ticks, as the
// dish loop), seeds 1–3. Prints markdown (docs/TERRARIUM.md); --write also writes the web table.
const MS = 1500;
const SEEDS = [1, 2, 3];
const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const OUT = root('apps/web/src/scene/dish/table.ts');

type Op = keyof typeof OPERATIONS;
/** The four card ops; `p1on` is exploratory (§Open: a fifth op only if robust), not written to the table. */
const BRAINS = ['none', 'panic', 'moon', 'sugar', 'p1', 'p1on'] as const;
type Brain = (typeof BRAINS)[number];
const CARD: readonly Brain[] = ['none', 'panic', 'moon', 'sugar', 'p1'];

const g = await loadGraphCache(root('data/cache/graph'));
const full = buildGraph(orderNeurons(g.neurons.map(toRecord)), g.edges);
const net = buildNet(full);
const cells = { types: full.meta.map((r) => r.type), sides: full.meta.map((r) => r.somaSide) };
const senses = resolveGroups(cells, SENSES);
const cmd = resolveGroups(cells, COMMANDS);
const opRows = resolveGroups(
  cells,
  Object.fromEntries(Object.entries(OPERATIONS).map(([k, o]) => [k, o.types])) as Record<Op, RegExp>,
);

interface Take {
  /** Distinct actions in order (walk dropped). */
  acts: Decision[];
  /** First decision: sim ms and ms since its sense came on (null = sense never on). */
  t: number | null;
  ms: number | null;
  /** Peak kernel rate of each command over the run, Hz per cell. */
  peak: Record<Command, number>;
  events: WorldEvent['kind'][];
}

const on = (s: Senses, k: keyof Senses) => {
  const v = s[k];
  return typeof v === 'number' ? v > 0 : v.L > 0 || v.R > 0;
};

function take(stim: Stimulus, brain: Brain, seed: number): Take {
  const sim = createSim(net, {}, mulberry32(seed));
  if (brain === 'p1on') for (const i of opRows.p1.all) sim.stimulate(i, SENSE_HZ);
  else if (brain !== 'none')
    for (const i of opRows[brain].all)
      OPERATIONS[brain].mode === 'off' ? sim.silence(i) : sim.stimulate(i, SENSE_HZ);
  const world = new World(seed);
  const tick = delivery(stim);
  const meter = new CommandMeter(cmd);
  const onset: Partial<Record<keyof Senses, number>> = {};
  const peak = { jump: 0, back: 0, eat: 0, court: 0, gate: 0 };
  const res: Take = { acts: [], t: null, ms: null, peak, events: [] };
  let prev = new Map<number, number>();
  let act: Action = 'walk';
  for (let t = 1; t <= MS; t++) {
    tick(world);
    sim.run(1);
    const { t: st, id, count } = sim.spikes;
    meter.add({ t: st.subarray(0, count), row: id.subarray(0, count) });
    sim.clearSpikes();
    const r = meter.rates(sim.t);
    for (const k of Object.keys(peak) as Command[]) peak[k] = Math.max(peak[k], r[k]);
    const was: Action = act;
    act = decide(r, act);
    if (act !== was && act !== 'walk') {
      if (res.acts.at(-1) !== act) res.acts.push(act);
      if (res.t === null) {
        res.t = t;
        const o = onset[PATHS[act].sense];
        res.ms = o === undefined ? null : t - o;
      }
    }
    res.events.push(...world.step(1, act).map((e) => e.kind));
    const s = world.sense();
    for (const k of Object.keys(s) as (keyof Senses)[]) if (on(s, k) && onset[k] === undefined) onset[k] = t;
    const next = senseDrive(s, senses);
    const d = diffDrive(prev, next);
    prev = next;
    d.rows.forEach((i, k) => {
      sim.stimulate(i, d.hz[k] ?? 0);
    });
  }
  return res;
}

/** Most common first action over seeds ('walk' = no decision); robust when all seeds agree. */
interface Cell {
  action: Action;
  robust: boolean;
  /** Median over the seeds that took `action`: decision latency from sense onset, and its command peak. */
  ms: number | null;
  hz: number;
  hit: boolean;
  takes: Take[];
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[(s.length - 1) >> 1] ?? 0) : 0;
};
function cell(takes: Take[]): Cell {
  const first = takes.map((x) => x.acts[0] ?? 'walk');
  const count = new Map<Action, number>();
  for (const a of first) count.set(a, (count.get(a) ?? 0) + 1);
  const action = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'walk';
  const same = takes.filter((_, i) => first[i] === action);
  const ms = same.map((x) => x.ms).filter((m): m is number => m !== null);
  return {
    action,
    robust: count.get(action) === takes.length,
    ms: ms.length ? median(ms) : null,
    hz: action === 'walk' ? 0 : Math.round(median(same.map((x) => x.peak[action]))),
    hit: takes.some((x) => x.events.includes('hit')),
    takes,
  };
}

const table = {} as Record<Stimulus, Record<Brain, Cell>>;
const t0 = performance.now();
for (const stim of STIMULI) {
  table[stim] = {} as Record<Brain, Cell>;
  for (const brain of BRAINS) {
    table[stim][brain] = cell(SEEDS.map((s) => take(stim, brain, s)));
    process.stderr.write(`${stim} × ${brain}: ${table[stim][brain].action}\n`);
  }
}
process.stderr.write(`${((performance.now() - t0) / 1000).toFixed(0)} s\n`);

const fmt = (c: Cell) =>
  `${c.robust ? '' : '~'}${c.action}${c.ms === null ? '' : ` ${c.ms}`}${c.hit ? ' ✗hit' : ''}`;
console.log(`### Norm table (9.2, scripted delivery, ${MS} ms, seeds ${SEEDS.join(',')})\n`);
console.log('First decision · ms from sense onset · `~` = seeds disagree · ✗hit = swatter hit.\n');
console.log(`| stimulus | ${BRAINS.join(' | ')} |`);
console.log(`| --- | ${BRAINS.map(() => '---').join(' | ')} |`);
for (const stim of STIMULI)
  console.log(`| ${stim} | ${BRAINS.map((b) => fmt(table[stim][b])).join(' | ')} |`);
console.log('\nPer seed: action sequence @ first decision ms (peak Hz TTMn / MDN / MN9 / pIP10 / pC1)\n');
for (const stim of STIMULI)
  for (const brain of BRAINS) {
    const row = table[stim][brain].takes
      .map((x) => {
        const p = (['jump', 'back', 'eat', 'court', 'gate'] as const)
          .map((k) => x.peak[k].toFixed(0))
          .join('/');
        return `${x.acts.join('→') || 'walk'}${x.t === null ? '' : ` @${x.t}`} (${p})`;
      })
      .join('; ');
    console.log(`- ${stim} × ${brain}: ${row}`);
  }

if (process.argv.includes('--write')) {
  const rows = STIMULI.map((stim) => {
    const cols = CARD.map((b) => {
      const c = table[stim][b];
      return `${b}: { action: '${c.action}', ms: ${c.ms}, hz: ${c.hz}, robust: ${c.robust}, hit: ${c.hit} }`;
    });
    return `  ${stim}: {\n    ${cols.join(',\n    ')},\n  },`;
  });
  writeFileSync(
    OUT,
    `import type { Action, OPERATIONS, Stimulus } from '@fly/sim';

// Generated by \`pnpm --filter pipeline explore:norm --write\` (9.2) — do not edit by hand.
// What the fly does per scripted stimulus × brain state, majority over seeds ${SEEDS.join(',')}, ${MS} ms.

export type Brain = 'none' | keyof typeof OPERATIONS;
export interface Norm {
  /** First decision ('walk' = none within the run). */
  action: Action;
  /** Sense onset → decision, sim ms (median over seeds); null without a sense or a decision. */
  ms: number | null;
  /** Peak rate of the deciding command, Hz per cell (0 for walk). */
  hz: number;
  /** All seeds agree. */
  robust: boolean;
  /** The swatter hit the fly in some seed. */
  hit: boolean;
}

export const NORM: Record<Stimulus, Record<Brain, Norm>> = {
${rows.join('\n')}
};
`,
  );
  process.stderr.write(`wrote ${OUT}\n`);
}
