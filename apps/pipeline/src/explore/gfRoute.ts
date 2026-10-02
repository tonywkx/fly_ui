import { fileURLToPath } from 'node:url';
import { createSim, mulberry32, type Spikes } from '@fly/sim';
import { loadGraphCache } from '../fetch/graph';
import { firstSpike, inputDrive } from '../process/drive';
import { buildGraph, orderNeurons, toRecord } from '../process/graph';
import { SCENARIO_RUNS } from '../process/scenarios';
import { buildNet } from '../process/spikes';

// 3.7 exploratory: with the Giant Fiber (DNp01) silenced, what still drives TTMn on looming? Prints markdown.
const GF = 'DNp01';
const TARGET = 'TTMn';
const cache = fileURLToPath(new URL('../../../../data/cache/graph', import.meta.url));
const esc = SCENARIO_RUNS.escape;
if (!esc) throw new Error('no escape run');

const g = await loadGraphCache(cache);
const full = buildGraph(orderNeurons(g.neurons.map(toRecord)), g.edges);
const { meta } = full;
const net = buildNet(full);
const sec = esc.durationMs / 1000;

const byType = new Map<string, number[]>();
meta.forEach((r, i) => {
  if (r.type === null) return;
  const ids = byType.get(r.type) ?? [];
  ids.push(i);
  byType.set(r.type, ids);
});
const cells = (type: string) => byType.get(type) ?? [];
const isDN = (type: string) => {
  const r = meta[cells(type)[0] as number];
  return /descending/i.test(`${r?.superclass} ${r?.class}`);
};

/** Escape run over the whole graph (same order as runScenario with all rows): silence first, then stimulate. */
function run(silence: string[], seed = esc!.seed): Spikes {
  const sim = createSim(net, esc!.params, mulberry32(seed));
  const silent = new Set(silence);
  const stim = new Set(esc!.stimTypes);
  meta.forEach((r, i) => {
    if (r.type === null) return;
    if (silent.has(r.type)) sim.silence(i);
    if (stim.has(r.type)) sim.stimulate(i, esc!.hz);
  });
  for (let ms = 0; ms < esc!.durationMs; ms++) sim.run(1);
  return sim.spikes;
}

function counts(s: Spikes) {
  const c = new Uint32Array(meta.length);
  for (let k = 0; k < s.count; k++) c[s.id[k] as number] = (c[s.id[k] as number] as number) + 1;
  return c;
}
const hz = (c: Uint32Array, type: string) => {
  const ids = cells(type);
  return ids.reduce((a, i) => a + (c[i] as number), 0) / ids.length / sec;
};
const target = (s: Spikes) => {
  const c = counts(s);
  return { hz: hz(c, TARGET), first: firstSpike(s, cells(TARGET)) };
};
/** Drive (mV) into `type` aggregated by presynaptic type; untyped cells pooled as "(untyped)". */
function driveByType(s: Spikes, type: string): [string, number][] {
  const d = inputDrive(net, s, cells(type));
  const agg = new Map<string, number>();
  d.forEach((x, i) => {
    if (x === 0) return;
    const t = meta[i]?.type ?? '(untyped)';
    agg.set(t, (agg.get(t) ?? 0) + x);
  });
  return [...agg].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
}
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const row = (...xs: (string | number)[]) => console.log(`| ${xs.join(' | ')} |`);
const head = (...xs: string[]) => {
  row(...xs);
  row(...xs.map(() => '---'));
};

console.log(
  `DNp01 superclass/class: ${meta[cells(GF)[0] as number]?.superclass} / ${meta[cells(GF)[0] as number]?.class}\n`,
);

// 1. Robustness over seeds.
console.log(`### ${TARGET} intact vs ${GF} silenced (seeds 1–5)\n`);
head('seed', 'intact Hz', 'intact 1st ms', 'silenced Hz', 'silenced 1st ms');
for (let seed = 1; seed <= 5; seed++) {
  const a = target(run([], seed));
  const b = target(run([GF], seed));
  row(seed, f1(a.hz), f1(a.first), f1(b.hz), f1(b.first));
}

// 2. Descending neurons still active without GF.
const intact = run([]);
const silenced = run([GF]);
const cI = counts(intact);
const cS = counts(silenced);
const dns = [...byType.keys()].filter(isDN);
const dnRates = dns
  .map((t) => ({ t, s: hz(cS, t), i: hz(cI, t), first: firstSpike(silenced, cells(t)) }))
  .filter((d) => d.s > 0)
  .sort((a, b) => b.s - a.s);
console.log(
  `\n### Descending types active with ${GF} silenced (seed ${esc.seed}, top 15 of ${dnRates.length})\n`,
);
head('type', 'cells', 'silenced Hz', 'intact Hz', '1st spike ms');
for (const d of dnRates.slice(0, 15)) row(d.t, cells(d.t).length, f1(d.s), f1(d.i), f1(d.first));

// 3. Who drives TTMn, intact vs silenced.
const top = (xs: [string, number][], n: number) =>
  xs.slice(0, n).map(([t, x]) => `${t}${isDN(t) ? '*' : ''} ${x.toFixed(0)}`);
console.log(`\n### Drive into ${TARGET} by presynaptic type (mV summed over run; * = descending)\n`);
console.log(`- intact: ${top(driveByType(intact, TARGET), 10).join(', ')}`);
console.log(`- silenced: ${top(driveByType(silenced, TARGET), 10).join(', ')}`);

// 4. Back-trace the strongest excitatory inputs (silenced run).
console.log(`\n### Excitatory back-trace from ${TARGET} (silenced, 3 hops × top 3)\n`);
const traced = new Set<string>();
const seen = new Map<string, number>(); // type → hop from TARGET
function trace(type: string, depth: number, indent: string) {
  if (depth === 0 || traced.has(type)) return;
  traced.add(type);
  for (const [t, x] of driveByType(silenced, type)
    .filter(([, x]) => x > 0)
    .slice(0, 3)) {
    seen.set(t, Math.min(seen.get(t) ?? 9, 4 - depth));
    console.log(`${indent}- ${t}${isDN(t) ? '*' : ''} (${x.toFixed(0)} mV, ${f1(hz(cS, t))} Hz)`);
    trace(t, depth - 1, `${indent}  `);
  }
}
trace(TARGET, 3, '');

// 5. Ablation: GF + X, X = traced descending types, relays within 2 hops, top DNs by rate.
const stim = new Set(esc.stimTypes);
const tracedDNs = [...seen.keys()].filter((t) => isDN(t) && t !== GF);
const relays = [...seen].filter(([t, hop]) => hop <= 2 && !isDN(t) && !stim.has(t) && t !== TARGET).map(([t]) => t);
const topDNs = dnRates
  .slice(0, 6)
  .map((d) => d.t)
  .filter((t) => !tracedDNs.includes(t));
console.log(`\n### Ablation (${GF} + X silenced, seed ${esc.seed})\n`);
head('also silenced', `${TARGET} Hz`, '1st spike ms');
const ablate = (label: string, types: string[]) => {
  const r = target(run([GF, ...types]));
  row(label, f1(r.hz), f1(r.first));
};
const base = target(silenced);
row('— (GF only)', f1(base.hz), f1(base.first));
for (const t of [...tracedDNs, ...relays, ...topDNs]) ablate(t, [t]);
ablate(`traced DNs: ${tracedDNs.join(' + ')}`, tracedDNs);
ablate(`relays: ${relays.join(' + ')}`, relays);
ablate('all of the above', [...tracedDNs, ...relays, ...topDNs]);
