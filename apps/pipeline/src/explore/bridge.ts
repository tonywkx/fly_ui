import type { NeuronRecord } from '@fly/data';
import {
  type Action,
  COMMANDS,
  CommandMeter,
  createSim,
  decide,
  diffDrive,
  eyes,
  mulberry32,
  type Net,
  OPERATIONS,
  resolveGroups,
  SENSE_HZ,
  SENSES,
  type Senses,
  senseDrive,
} from '@fly/sim';

// 8.3 calibration: the Terrarium closed loop (senses → drive → spikes → meter → decide) on the full graph.
const MS = 300;
const TICK = 10;
const SEEDS = [1, 2, 3];
const ODOR = /^ORN_(DM1|DM2|VA2|DM4)$/;

const none: Senses = { sugar: 0, bitter: 0, loom: { L: 0, R: 0 }, female: { L: 0, R: 0 } };
type Op = keyof typeof OPERATIONS;
interface Case {
  name: string;
  senses?: Partial<Senses>;
  ops?: Op[];
  /** Extra constant drive outside the Terrarium senses (types). */
  extra?: RegExp;
  /** Omitted: informational (an input the world never sends, e.g. one eye only). */
  expect?: Action;
}
const CASES: Case[] = [
  { name: 'baseline', expect: 'walk' },
  { name: 'loom L eye only', senses: { loom: { L: 1, R: 0 } } },
  { name: 'loom R eye only', senses: { loom: { L: 0, R: 1 } } },
  { name: 'loom ahead', senses: { loom: eyes(0, 1) }, expect: 'jump' },
  { name: 'loom left', senses: { loom: eyes(Math.PI / 2, 1) }, expect: 'jump' },
  { name: 'loom right', senses: { loom: eyes(-Math.PI / 2, 1) }, expect: 'jump' },
  { name: 'loom left + panic off', senses: { loom: eyes(Math.PI / 2, 1) }, ops: ['panic'], expect: 'walk' },
  { name: 'loom ahead + panic off', senses: { loom: eyes(0, 1) }, ops: ['panic'], expect: 'walk' },
  { name: 'sugar', senses: { sugar: 1 }, expect: 'eat' },
  { name: 'sugar + sugar off', senses: { sugar: 1 }, ops: ['sugar'], expect: 'walk' },
  { name: 'bitter', senses: { bitter: 1 }, expect: 'back' },
  { name: 'MDN on', ops: ['moon'], expect: 'back' },
  { name: 'female ahead', senses: { female: eyes(0, 1) }, expect: 'court' },
  { name: 'female L eye only', senses: { female: { L: 1, R: 0 } } },
  { name: 'female left', senses: { female: eyes(Math.PI / 2, 1) }, expect: 'court' },
  { name: 'female left + P1 off', senses: { female: eyes(Math.PI / 2, 1) }, ops: ['p1'], expect: 'walk' },
  { name: 'female ahead + P1 off', senses: { female: eyes(0, 1) }, ops: ['p1'], expect: 'walk' },
  { name: 'banana odor', extra: ODOR, expect: 'walk' },
];

export function runBridge(net: Net, meta: NeuronRecord[]): void {
  const cells = { types: meta.map((r) => r.type), sides: meta.map((r) => r.somaSide) };
  const senses = resolveGroups(cells, SENSES);
  const cmd = resolveGroups(cells, COMMANDS);
  const ops = resolveGroups(
    cells,
    Object.fromEntries(Object.entries(OPERATIONS).map(([k, o]) => [k, o.types])) as Record<Op, RegExp>,
  );
  const extra = (re: RegExp) => resolveGroups(cells, { x: re }).x.all;

  function run(c: Case, seed: number) {
    const sim = createSim(net, {}, mulberry32(seed));
    for (const op of c.ops ?? []) {
      const rows = (ops[op] as { all: Uint32Array }).all;
      for (const i of rows) OPERATIONS[op].mode === 'off' ? sim.silence(i) : sim.stimulate(i, SENSE_HZ);
    }
    if (c.extra) for (const i of extra(c.extra)) sim.stimulate(i, SENSE_HZ);
    const meter = new CommandMeter(cmd);
    const s: Senses = { ...none, ...c.senses };
    let prev = new Map<number, number>();
    let act: Action = 'walk';
    const ticks = new Map<Action, number>();
    let first: { act: Action; t: number } | undefined;
    const peak = { jump: 0, back: 0, eat: 0, court: 0, gate: 0 };
    for (let t = 0; t < MS; t += TICK) {
      const next = senseDrive(s, senses);
      const d = diffDrive(prev, next);
      prev = next;
      d.rows.forEach((i, k) => {
        sim.stimulate(i, d.hz[k]);
      });
      sim.run(TICK);
      const { t: st, id, count } = sim.spikes;
      meter.add({ t: st.subarray(0, count), row: id.subarray(0, count) });
      sim.clearSpikes();
      const r = meter.rates(sim.t);
      for (const k of Object.keys(peak) as (keyof typeof peak)[]) peak[k] = Math.max(peak[k], r[k]);
      act = decide(r, act);
      ticks.set(act, (ticks.get(act) ?? 0) + 1);
      if (act !== 'walk' && !first) first = { act, t: sim.t };
    }
    return { first, ticks, peak };
  }

  const n = MS / TICK;
  console.log(`# Terrarium bridge — closed loop, ${TICK} ms ticks, ${MS} ms, seeds ${SEEDS.join(',')}\n`);
  console.log(
    '| case | expect | seed → first action @ ms · share of ticks | peak Hz min–max over seeds (TTMn / MDN / MN9 / pIP10 / pC1) | ok |',
  );
  console.log('| --- | --- | --- | --- | --- |');
  for (const c of CASES) {
    const res = SEEDS.map((seed) => run(c, seed));
    const cell = res
      .map(({ first, ticks }) =>
        first
          ? `${first.act} @ ${first.t.toFixed(0)} · ${(((ticks.get(first.act) ?? 0) / n) * 100).toFixed(0)} %`
          : 'walk',
      )
      .join('; ');
    const keys = ['jump', 'back', 'eat', 'court', 'gate'] as const;
    const pk = keys
      .map((k) => {
        const v = res.map((r) => r.peak[k]);
        return `${Math.min(...v).toFixed(0)}–${Math.max(...v).toFixed(0)}`;
      })
      .join(' / ');
    const ok = c.expect
      ? res.every(({ first }) => (first?.act ?? 'walk') === c.expect)
        ? 'yes'
        : '**no**'
      : '—';
    console.log(`| ${c.name} | ${c.expect ?? '—'} | ${cell} | ${pk} | ${ok} |`);
  }
}
