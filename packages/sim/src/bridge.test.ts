import { describe, expect, it } from 'vitest';
import {
  type Action,
  COMMANDS,
  CommandMeter,
  decide,
  diffDrive,
  eyes,
  type Rates,
  resolveGroups,
  SENSES,
  senseDrive,
  PREEMPT_BACK,
  THRESHOLDS,
} from './bridge';

const types = [
  'LB3a',
  'LB3',
  'LB1c',
  'LC4',
  'LC4',
  'LPLC2',
  'LC10a',
  'LC10a',
  'TTMn',
  'MDN',
  'MN9',
  'pIP10',
  'pC1a',
  null,
];
const sides = [null, null, null, 'L', 'R', 'R', 'L', 'R', 'L', 'R', 'L', 'L', 'R', null];
const g = resolveGroups({ types, sides }, SENSES);

const rest: Rates = { jump: 0, back: 0, eat: 0, court: 0, gate: 0 };
const senses = { sugar: 0, bitter: 0, loom: { L: 0, R: 0 }, female: { L: 0, R: 0 } };

describe('resolveGroups', () => {
  it('picks rows by type and splits them by side', () => {
    expect([...g.sugar.all]).toEqual([0, 1]);
    expect([...g.bitter.all]).toEqual([2]);
    expect([...g.loom.all]).toEqual([3, 4, 5]);
    expect([...g.loom.L]).toEqual([3]);
    expect([...g.loom.R]).toEqual([4, 5]);
    expect([...g.female.R]).toEqual([7]);
  });

  it('resolves command groups', () => {
    const c = resolveGroups({ types, sides }, COMMANDS);
    expect([...c.jump.all]).toEqual([8]);
    expect([...c.gate.all]).toEqual([12]);
  });
});

describe('senseDrive', () => {
  it('is empty when nothing is sensed', () => {
    expect(senseDrive(senses, g).size).toBe(0);
  });

  it('drives a whole unsided group and one side of a sided group, scaled by intensity', () => {
    const d = senseDrive({ ...senses, sugar: 1, loom: { L: 0, R: 0.5 } }, g, 150);
    expect(Object.fromEntries(d)).toEqual({ 0: 150, 1: 150, 4: 75, 5: 75 });
  });

  it('clamps intensity to 0…1', () => {
    const d = senseDrive({ ...senses, bitter: 3, female: { L: -1, R: 0 } }, g, 100);
    expect(Object.fromEntries(d)).toEqual({ 2: 100 });
  });
});

describe('eyes', () => {
  it('sees ahead and behind with both eyes', () => {
    expect(eyes(0, 1)).toEqual({ L: 1, R: 1 });
    expect(eyes(Math.PI, 0.5).L).toBeCloseTo(0.5, 9);
    expect(eyes(Math.PI, 0.5).R).toBeCloseTo(0.5, 9);
  });

  it('gives the far eye three quarters at the side', () => {
    expect(eyes(Math.PI / 2, 1)).toEqual({ L: 1, R: 0.75 });
    expect(eyes(-Math.PI / 2, 2)).toEqual({ L: 1.5, R: 2 });
  });
});

describe('diffDrive', () => {
  it('sends only changed rows; dropped rows go to 0 Hz', () => {
    const prev = new Map([
      [0, 150],
      [1, 150],
      [4, 75],
    ]);
    const next = new Map([
      [0, 150],
      [4, 100],
      [6, 50],
    ]);
    const d = diffDrive(prev, next);
    const pairs = [...d.rows].map((r, k) => [r, d.hz[k]]).sort((a, b) => (a[0] as number) - (b[0] as number));
    expect(pairs).toEqual([
      [1, 0],
      [4, 100],
      [6, 50],
    ]);
  });

  it('is empty for equal drives', () => {
    const m = new Map([[3, 10]]);
    expect(diffDrive(m, new Map(m)).rows.length).toBe(0);
  });
});

describe('CommandMeter', () => {
  const c = resolveGroups({ types, sides }, COMMANDS);

  it('reads per-cell rates of each command group', () => {
    const m = new CommandMeter(c);
    const t: number[] = [];
    const row: number[] = [];
    for (let ms = 0; ms < 500; ms += 5) {
      t.push(ms);
      row.push(8); // TTMn at 200 Hz
      if (ms % 10 === 0) {
        t.push(ms);
        row.push(10); // MN9 at 100 Hz
      }
    }
    m.add({ t: Float32Array.from(t), row: Uint32Array.from(row) });
    const r = m.rates(495);
    expect(r.jump).toBeGreaterThan(180);
    expect(r.eat).toBeGreaterThan(85);
    expect(r.eat).toBeLessThan(115);
    expect(r.back).toBe(0);
  });

  it('decays to rest without spikes and resets', () => {
    const m = new CommandMeter(c);
    m.add({ t: Float32Array.of(0, 1, 2), row: Uint32Array.of(9, 9, 9) });
    expect(m.rates(2).back).toBeGreaterThan(0);
    expect(m.rates(1000).back).toBeLessThan(1e-6);
    m.reset();
    expect(m.rates(2).back).toBe(0);
  });

  it('ignores rows outside the command groups', () => {
    const m = new CommandMeter(c);
    m.add({ t: Float32Array.of(0), row: Uint32Array.of(0) });
    expect(m.rates(0)).toEqual(rest);
  });
});

describe('decide', () => {
  const T = THRESHOLDS;
  const at = (r: Partial<Rates>, prev: Action = 'walk') => decide({ ...rest, ...r }, prev);

  it('lets only a strong back command break off eating or courting', () => {
    expect(at({ back: 100, eat: 200 }, 'eat')).toBe('eat');
    expect(at({ back: 100, court: 60, gate: 5 }, 'court')).toBe('court');
    expect(at({ back: PREEMPT_BACK, eat: 200 }, 'eat')).toBe('back');
    expect(at({ back: 100, eat: 200 }, 'walk')).toBe('back');
    expect(at({ jump: 200, eat: 200 }, 'eat')).toBe('jump');
  });

  it('walks at rest', () => {
    expect(at({})).toBe('walk');
  });

  it('crosses each threshold', () => {
    expect(at({ jump: T.jump.on })).toBe('jump');
    expect(at({ back: T.back.on })).toBe('back');
    expect(at({ eat: T.eat.on })).toBe('eat');
    expect(at({ court: T.court.on, gate: T.gate.on })).toBe('court');
  });

  it('stays below thresholds (8.1 cases)', () => {
    expect(at({ jump: 44 })).toBe('walk'); // panic neuron off
    expect(at({ jump: 134 })).toBe('walk'); // panic neuron off
    expect(at({ eat: 104 })).toBe('walk'); // female, P1 off
    expect(at({ back: 45 })).toBe('walk'); // female
  });

  it('courts only with the P1 gate open', () => {
    expect(at({ court: 63, gate: 0 })).toBe('walk'); // P1 off
    expect(at({ court: 90, gate: 13 })).toBe('court');
  });

  it('ranks jump > back > eat > court', () => {
    const all = { jump: 300, back: 100, eat: 200, court: 100, gate: 20 };
    expect(at(all)).toBe('jump');
    expect(at({ ...all, jump: 0 })).toBe('back');
    expect(at({ ...all, jump: 0, back: 0 })).toBe('eat');
    expect(at({ ...all, jump: 0, back: 0, eat: 0 })).toBe('court');
  });

  it('holds the current action down to its off threshold', () => {
    const mid = (k: 'jump' | 'back' | 'eat') => (T[k].on + T[k].off) / 2;
    for (const k of ['jump', 'back', 'eat'] as const) {
      expect(at({ [k]: mid(k) }, 'walk')).toBe('walk');
      expect(at({ [k]: mid(k) }, k)).toBe(k);
      expect(at({ [k]: T[k].off - 1 }, k)).toBe('walk');
    }
    const court = (T.court.on + T.court.off) / 2;
    expect(at({ court, gate: T.gate.on }, 'court')).toBe('court');
    expect(at({ court, gate: T.gate.on }, 'walk')).toBe('walk');
  });
});
