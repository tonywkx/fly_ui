import { fileURLToPath } from 'node:url';
import { createSim, mulberry32, type Spikes } from '@fly/sim';
import { loadGraphCache } from '../fetch/graph';
import { cypher } from '../neuprint';
import { clientFromEnv } from '../neuprint/fromEnv';
import { firstSpike } from '../process/drive';
import { buildGraph, orderNeurons, toRecord } from '../process/graph';
import { buildNet } from '../process/spikes';

// 8.1 Terrarium feasibility: sensory input → command neurons (rate, L/R), surgeon operations. Prints markdown.
const HZ = 150;
const MS = 300;
const SEEDS = [1, 2, 3];
const cache = fileURLToPath(new URL('../../../../data/cache/graph', import.meta.url));

type Pick = (type: string) => boolean;
const is =
  (...types: string[]): Pick =>
  (t) =>
    types.includes(t);
const prefix =
  (p: string): Pick =>
  (t) =>
    t.startsWith(p);

/** Sensory groups (types per neuPrint male-cns:v1.0; see docs/TERRARIUM.md for the proxies). */
const SENSES: Record<string, Pick> = {
  sugar: is('LB3', 'LB3a', 'LB3b', 'LB3c', 'LB3d'),
  'bitter? LB4': is('LB4a', 'LB4b'),
  'bitter? LB2': is('LB2a', 'LB2b', 'LB2c', 'LB2d'),
  'bitter? LB1': prefix('LB1'),
  'odor (banana ORNs)': is('ORN_DM1', 'ORN_DM2', 'ORN_VA2', 'ORN_DM4'),
  'loom (LC4+LPLC2)': is('LC4', 'LPLC2'),
  'female visual (LC10a)': is('LC10a'),
  'female touch? (LgLG1)': is('LgLG1a', 'LgLG1b'),
  'groom (JO-FV)': is('JO-FV'),
  'groom (BM_InOm)': is('BM_InOm'),
};
/** Inputs that get a per-side split (needs rootSide for sensory cells). */
const SIDED = ['sugar', 'odor (banana ORNs)', 'loom (LC4+LPLC2)', 'female visual (LC10a)', 'groom (JO-FV)'];

/** Read-out groups; `sided` prints L/R. */
const COMMANDS: { name: string; pick: Pick; sided?: boolean }[] = [
  { name: 'DNp01', pick: is('DNp01') },
  { name: 'TTMn', pick: is('TTMn') },
  { name: 'MDN', pick: is('MDN') },
  { name: 'DNa01', pick: is('DNa01'), sided: true },
  { name: 'DNa02', pick: is('DNa02'), sided: true },
  { name: 'DNb05', pick: is('DNb05'), sided: true },
  { name: 'DNb06', pick: is('DNb06'), sided: true },
  { name: 'DNp09', pick: is('DNp09') },
  { name: 'DNg97', pick: is('DNg97') },
  { name: 'DNg11', pick: is('DNg11') },
  { name: 'DNg12', pick: prefix('DNg12_') },
  { name: 'MN9', pick: is('MN9') },
  { name: 'P1 (pC1)', pick: prefix('pC1') },
  { name: 'pIP10', pick: is('pIP10') },
];

const g = await loadGraphCache(cache);
const full = buildGraph(orderNeurons(g.neurons.map(toRecord)), g.edges);
const { meta } = full;
const net = buildNet(full);
const rows = (pick: Pick) => meta.flatMap((r, i) => (r.type !== null && pick(r.type) ? [i] : []));

// Side: somaSide from the graph; sensory cells have none → rootSide from neuPrint.
const side = new Map<number, string>();
meta.forEach((r, i) => {
  if (r.somaSide === 'L' || r.somaSide === 'R') side.set(i, r.somaSide);
});
const needSide = SIDED.flatMap((k) => rows(SENSES[k] as Pick)).filter((i) => !side.has(i));
const byBody = new Map(meta.map((r, i) => [r.bodyId, i]));
const res = await clientFromEnv().query<{ id: number; side: string | null }>(
  cypher`MATCH (n:Neuron) WHERE n.bodyId IN ${needSide.map((i) => meta[i]?.bodyId ?? 0)}
         RETURN n.bodyId AS id, n.rootSide AS side`,
);
for (const { id, side: s } of res) {
  const i = byBody.get(id);
  if (i !== undefined && (s === 'L' || s === 'R')) side.set(i, s);
}
const onSide = (ids: number[], s: 'L' | 'R') => ids.filter((i) => side.get(i) === s);

interface Run {
  stim?: number[];
  silence?: number[];
  seed: number;
}
function run({ stim = [], silence = [], seed }: Run): Spikes {
  const sim = createSim(net, {}, mulberry32(seed));
  for (const i of silence) sim.silence(i);
  for (const i of stim) sim.stimulate(i, HZ);
  sim.run(MS);
  return sim.spikes;
}
/** Mean rate (Hz) per cell of `ids`, averaged over seeds; first spike from seed 1. */
function readout(r: Omit<Run, 'seed'>) {
  const c = new Float64Array(meta.length);
  let first: Spikes | undefined;
  for (const seed of SEEDS) {
    const s = run({ ...r, seed });
    first ??= s;
    for (let k = 0; k < s.count; k++) c[s.id[k] as number] = (c[s.id[k] as number] as number) + 1;
  }
  const hz = (ids: number[]) =>
    ids.length
      ? ids.reduce((a, i) => a + (c[i] as number), 0) / ids.length / SEEDS.length / (MS / 1000)
      : NaN;
  return { hz, first: (ids: number[]) => firstSpike(first as Spikes, ids) };
}

const f0 = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : '—');
const row = (...xs: (string | number)[]) => console.log(`| ${xs.join(' | ')} |`);
const head = (...xs: string[]) => {
  row(...xs);
  row(...xs.map(() => '---'));
};
const cmdIds = COMMANDS.map((c) => ({ ...c, ids: rows(c.pick) }));
const cells = (r: ReturnType<typeof readout>) =>
  cmdIds.map((c) =>
    c.sided ? `${f0(r.hz(onSide(c.ids, 'L')))}/${f0(r.hz(onSide(c.ids, 'R')))}` : f0(r.hz(c.ids)),
  );

console.log(`# Terrarium feasibility — ${HZ} Hz Poisson, ${MS} ms, seeds ${SEEDS.join(',')}; Hz per cell\n`);
console.log(
  `Command cells: ${cmdIds.map((c) => `${c.name} ${c.ids.length}`).join(', ')}. Sided columns are L/R.\n`,
);
head('input', 'cells', ...COMMANDS.map((c) => c.name));
row('— baseline', 0, ...cells(readout({})));
for (const [name, pick] of process.argv.includes('--ops') ? [] : Object.entries(SENSES)) {
  const ids = rows(pick);
  row(name, ids.length, ...cells(readout({ stim: ids })));
  if (!SIDED.includes(name)) continue;
  for (const s of ['L', 'R'] as const) {
    const sub = onSide(ids, s);
    row(`  ${name} ${s}`, sub.length, ...cells(readout({ stim: sub })));
  }
}

// Surgeon operations: before / after.
const ids = (name: string) => rows(SENSES[name] as Pick);
const cmd = (name: string) => cmdIds.find((c) => c.name === name)?.ids ?? [];
const OPS: { op: string; stim: number[]; silence?: number[]; watch: string[] }[] = [
  { op: 'loom', stim: ids('loom (LC4+LPLC2)'), watch: ['DNp01', 'TTMn', 'MDN', 'DNp09'] },
  {
    op: 'loom + DNp01 off',
    stim: ids('loom (LC4+LPLC2)'),
    silence: cmd('DNp01'),
    watch: ['DNp01', 'TTMn', 'MDN', 'DNp09'],
  },
  { op: 'MDN on', stim: cmd('MDN'), watch: ['MDN', 'DNp09', 'DNa02', 'DNp01'] },
  { op: 'sugar', stim: ids('sugar'), watch: ['MN9', 'DNp09', 'MDN'] },
  { op: 'sugar + LB3 off', stim: ids('sugar'), silence: ids('sugar'), watch: ['MN9', 'DNp09', 'MDN'] },
  { op: 'bitter (LB1)', stim: ids('bitter? LB1'), watch: ['MDN', 'MN9', 'DNp09'] },
  { op: 'female (LC10a)', stim: ids('female visual (LC10a)'), watch: ['P1 (pC1)', 'pIP10'] },
  {
    op: 'female (LC10a) + P1 off',
    stim: ids('female visual (LC10a)'),
    silence: cmd('P1 (pC1)'),
    watch: ['P1 (pC1)', 'pIP10'],
  },
  { op: 'P1 on', stim: cmd('P1 (pC1)'), watch: ['P1 (pC1)', 'pIP10'] },
];
console.log('\n## Surgeon operations (Hz per cell · first spike ms, seed 1)\n');
head('operation', 'read-out');
for (const o of OPS) {
  const r = readout({ stim: o.stim, silence: o.silence });
  row(o.op, o.watch.map((w) => `${w} ${f0(r.hz(cmd(w)))} · ${f0(r.first(cmd(w)))}`).join(', '));
}
