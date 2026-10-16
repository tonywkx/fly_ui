import { describe, expect, it } from 'vitest';
import { normOf } from '../scene/dish/discoveries';
import { NORM } from '../scene/dish/table';
import type { TakeResult } from '../scene/dish/take';
import { fromLevels, type Journal, litOf, parseJournal, type TrialMemory, TrialStore } from './trial';

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

  it('replays after the first result ever by itself, later only on ask; close and new runs end it', () => {
    const { s, mem } = setup();
    s.setStim('swatter');
    expect(s.replay()).toBe(false);
    s.start(true);
    s.finish(take());
    expect(s.replaying).toBe(true);
    s.closeReplay();
    expect(s.replaying).toBe(false);
    s.start();
    s.finish(take());
    expect(s.replaying).toBe(false);
    expect(s.replay()).toBe(true);
    s.start();
    expect(s.replaying).toBe(false);
    const again = setup(mem).s;
    again.setStim('shadow');
    again.start(true);
    again.finish(take());
    expect(again.replaying).toBe(false);
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
    // nothing decided: the journal keeps the norm command's peak (TTMn), as the «сейчас» row reads it
    expect(mem.pairs['swatter:panic']).toEqual({ bet: 'jump', result: 'hit', ms: null, hz: 44 });
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

  it('two tabs; a slot change, repeat or run goes back to the experiment; locked while running', () => {
    const { s } = setup();
    expect(s.tab).toBe('exp');
    s.setTab('found');
    expect(s.tab).toBe('found');
    s.repeat('shadow:panic');
    expect(s.tab).toBe('exp');
    s.setTab('found');
    s.repeat('shadow:panic');
    expect(s.tab).toBe('exp');
    s.setTab('found');
    s.repeat('banana:none');
    expect(s.tab).toBe('found');
    s.setStim('sugar');
    expect(s.tab).toBe('exp');
    s.setTab('found');
    s.start(true);
    expect(s.tab).toBe('exp');
    s.setTab('found');
    expect(s.tab).toBe('exp');
  });

  it('all found once every discovery has an entry', () => {
    const e = { bet: null, result: 'walk', ms: null, hz: 0 } as const;
    const ids = ['sugar:none', 'bitter:none', 'shadow:none', 'female:none', 'swatter:panic', 'sugar:sugar'];
    const more = ['female:p1', 'none:moon', 'shadow:panic', 'sugar:moon', 'female:moon'];
    const pairs = Object.fromEntries([...ids, ...more].map((id) => [id, e]));
    const { s } = setup({ pairs, last: null });
    expect(s.allFound).toBe(false);
    const { s: all } = setup({ pairs: { ...pairs, 'bitter:sugar': e }, last: null });
    expect(all.allFound).toBe(true);
  });

  it('chip order is fixed for a visit', () => {
    const a = setup().s;
    a.setStim('female');
    const b = setup().s;
    b.setStim('female');
    expect(a.chips).toEqual(b.chips);
  });
});

describe('surgeon slot', () => {
  const two = { off: 2, on: 0 };

  it('brain picks fill the slot; a named op switches them off but keeps them', () => {
    const { s } = setup();
    s.setStim('shadow');
    s.setSlot('brain');
    expect(s.slot).toBe('none');
    s.setPicks(two);
    expect(s.slot).toBe('brain');
    expect(s.op).toBe('none');
    expect(s.applied).toEqual(two);
    s.setSlot('panic');
    expect(s.op).toBe('panic');
    expect(s.applied).toBeNull();
    expect(s.picks).toEqual(two);
    s.setSlot('brain');
    expect(s.applied).toEqual(two);
  });

  it('forgetting the picks empties the slot only when it held them', () => {
    const { s } = setup();
    s.setPicks(two);
    s.setSlot('moon');
    s.forgetPicks();
    expect(s.picks).toBeNull();
    expect(s.slot).toBe('moon');
    s.setPicks(two);
    s.forgetPicks();
    expect(s.slot).toBe('none');
  });

  it('no picks = nothing to carry: empty counts forget them', () => {
    const { s } = setup();
    s.setPicks({ off: 0, on: 0 });
    expect(s.picks).toBeNull();
    expect(s.slot).toBe('none');
  });

  it('a brain-picks run asks no bet, records nothing and unlocks nothing', () => {
    const { s, mem } = setup();
    s.setStim('shadow');
    s.setPicks(two);
    expect(s.needsBet).toBe(false);
    expect(s.canRun).toBe(true);
    expect(s.start()).toBe(true);
    s.finish(take({ result: 'walk' }));
    expect(s.outcome).toMatchObject({ first: false, unlocked: null, bet: null });
    expect(s.outcome?.norm).toEqual(NORM.shadow.none);
    expect(s.pairs).toEqual({});
    expect(mem.pairs).toEqual({});
  });

  it('the hovered row lights its region, the whole brain, or nothing', () => {
    expect(litOf('panic')).toEqual({ region: 'PVLP', mode: 'off' });
    expect(litOf('moon')).toEqual({ region: 'LAL', mode: 'on' });
    expect(litOf('brain')).toBe('all');
    expect(litOf('none')).toBeNull();
    const { s } = setup();
    expect(s.lit).toBeNull();
    s.setPreview('sugar');
    expect(s.lit).toEqual({ region: 'GNG', mode: 'off' });
    s.setPreview(null);
    expect(s.lit).toBeNull();
  });

  it('the operated mark follows a named op only (brain picks have no site)', () => {
    const { s } = setup();
    expect(s.operated).toBeNull();
    s.setSlot('p1');
    expect(s.operated).toEqual({ region: 'AVLP', mode: 'off' });
    s.setPicks(two);
    expect(s.operated).toBeNull();
  });

  it('the op list: open while setting up, closing it drops the preview', () => {
    const { s } = setup();
    s.setListing(true);
    s.setPreview('panic');
    expect(s.listing).toBe(true);
    s.setListing(false);
    expect(s.listing).toBe(false);
    expect(s.preview).toBeNull();
  });

  it('a run closes the op list and keeps it shut', () => {
    const { s } = setup();
    s.setStim('none');
    s.setOp('panic');
    s.setListing(true);
    s.setPreview('moon');
    s.start(true);
    expect(s.listing).toBe(false);
    expect(s.preview).toBeNull();
    s.setListing(true);
    expect(s.listing).toBe(false);
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
