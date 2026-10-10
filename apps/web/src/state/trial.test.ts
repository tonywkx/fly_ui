import { describe, expect, it } from 'vitest';
import { normOf } from '../scene/dish/discoveries';
import type { TakeResult } from '../scene/dish/take';
import { fromLevels, type Journal, parseJournal, type TrialMemory, TrialStore } from './trial';

const peak = { jump: 44, back: 160, eat: 0, court: 0, gate: 0 };
const take = (t: Partial<TakeResult> = {}): TakeResult => ({ result: 'hit', ms: null, hz: 160, peak, ...t });

const setup = (init: Journal = { pairs: {}, last: null }) => {
  const mem: Journal = structuredClone(init);
  const memory: TrialMemory = {
    load: () => structuredClone(mem),
    save: (j) => Object.assign(mem, structuredClone(j)),
  };
  return { s: new TrialStore(memory, 1), mem };
};

describe('TrialStore', () => {
  it('cannot run without a stimulus, then asks for a bet the first time', () => {
    const { s } = setup();
    expect(s.canRun).toBe(false);
    s.setStim('swatter');
    s.setOp('panic');
    expect(s.needsBet).toBe(true);
    expect(s.canRun).toBe(false);
    expect([...s.chips].sort()).toEqual(['back', 'hit', 'jump']);
    s.setBet('jump');
    expect(s.canRun).toBe(true);
  });

  it('a forced start (`?run=1`) skips the bet but still needs a stimulus', () => {
    const { s } = setup();
    expect(s.start(true)).toBe(false);
    s.setStim('swatter');
    expect(s.start(true)).toBe(true);
    s.finish(take());
    expect(s.outcome).toMatchObject({ bet: null, first: true });
  });

  it('setup → running → result; the first run unlocks its discovery and is remembered', () => {
    const { s, mem } = setup();
    s.setStim('swatter');
    s.setOp('panic');
    s.setBet('jump');
    expect(s.start()).toBe(true);
    expect(s.phase).toBe('running');
    expect(s.run).toBe(1);
    s.finish(take());
    expect(s.phase).toBe('result');
    expect(s.outcome).toMatchObject({
      result: 'hit',
      bet: 'jump',
      first: true,
      unlocked: { id: 'swatter:panic' },
    });
    expect(s.outcome?.norm.action).toBe('jump');
    expect(s.found.map((d) => d.id)).toEqual(['swatter:panic']);
    expect(mem.pairs['swatter:panic']).toEqual({ bet: 'jump', result: 'hit', ms: null, hz: 160 });
    expect(mem.last).toBe('swatter:panic');
  });

  it('a repeat run skips the bet, shows the old one and unlocks nothing', () => {
    const { s, mem } = setup();
    s.setStim('sugar');
    s.setBet('walk');
    s.start();
    s.finish(take({ result: 'eat', ms: 61, hz: 259 }));
    s.again();
    expect(s.phase).toBe('running');
    s.finish(take({ result: 'eat', ms: 62, hz: 250 }));
    expect(s.outcome).toMatchObject({ bet: 'walk', first: false, unlocked: null, ms: 62 });
    expect(mem.pairs['sugar:none']?.ms).toBe(61);
  });

  it('a pair off the list keeps its bet but is not a discovery', () => {
    const { s } = setup();
    s.setStim('swatter');
    s.setOp('moon');
    s.setBet('back');
    s.start();
    s.finish(take({ result: 'back' }));
    expect(s.outcome?.unlocked).toBeNull();
    expect(s.found).toHaveLength(0);
    s.fresh();
    expect(s.needsBet).toBe(false);
  });

  it('stop goes back to setup and records nothing', () => {
    const { s, mem } = setup();
    s.setStim('none');
    s.setOp('moon');
    s.setBet('back');
    s.start();
    s.stop();
    expect(s.phase).toBe('setup');
    s.finish(take());
    expect(s.outcome).toBeNull();
    expect(mem.pairs).toEqual({});
    expect(s.bet).toBe('back');
  });

  it('slots are locked while running; changing one after a result goes back to setup', () => {
    const { s } = setup();
    s.setStim('bitter');
    s.setBet('back');
    s.start();
    s.setStim('sugar');
    expect(s.stim).toBe('bitter');
    s.finish(take({ result: 'back' }));
    s.setOp('sugar');
    expect(s.phase).toBe('setup');
    expect(s.outcome).toBeNull();
    expect(s.needsBet).toBe(true);
  });

  it('a return visit opens on the last pair; repeat fills the slots from a discovery', () => {
    const { s } = setup({
      pairs: { 'female:p1': { bet: 'court', result: 'walk', ms: null, hz: 0 } },
      last: 'female:p1',
    });
    expect([s.stim, s.op]).toEqual(['female', 'p1']);
    expect(s.needsBet).toBe(false);
    s.repeat('shadow:panic');
    expect([s.stim, s.op, s.phase]).toEqual(['shadow', 'panic', 'setup']);
    s.repeat('banana:none');
    expect(s.stim).toBe('shadow');
  });

  it('chip order is fixed for a visit', () => {
    const a = setup().s;
    a.setStim('female');
    const b = setup().s;
    b.setStim('female');
    expect(a.chips).toEqual(b.chips);
  });
});

describe('journal', () => {
  it('drops junk entries', () => {
    const j = parseJournal({
      pairs: {
        'sugar:none': { bet: 'eat', result: 'eat', ms: 61, hz: 259 },
        'banana:none': { bet: null, result: 'walk', ms: null, hz: 0 },
        'bitter:none': { bet: 'fly', result: 'back', ms: 60, hz: 139 },
        'female:none': 'court',
      },
      last: 'nope',
    });
    expect(Object.keys(j.pairs)).toEqual(['sugar:none']);
    expect(j.last).toBeNull();
    expect(parseJournal(null)).toEqual({ pairs: {}, last: null });
  });

  it('solved puzzles become discoveries 5–8 with the norm numbers', () => {
    const p = fromLevels([0, 3, 9]);
    expect(Object.keys(p)).toEqual(['swatter:panic', 'none:moon']);
    expect(p['swatter:panic']).toMatchObject({ bet: null, result: normOf({ stim: 'swatter', op: 'panic' }) });
  });
});
