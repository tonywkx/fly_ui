import { describe, expect, it } from 'vitest';
import type { TakeResult } from '../scene/dish/take';
import { type OnbMemory, OnboardingStore, startOnb } from './onboarding';
import { type Journal, TrialStore } from './trial';

const peak = { jump: 44, back: 160, eat: 0, court: 0, gate: 0 };
const take = (result: TakeResult['result']): TakeResult => ({ result, ms: 8, hz: 160, peak });

const setup = () => {
  const mem: Journal = { pairs: {}, last: null };
  const trial = new TrialStore({ load: () => structuredClone(mem), save: () => {} }, 1);
  const saved = { done: false };
  const memory: OnbMemory = { done: () => saved.done, save: () => (saved.done = true) };
  const onb = new OnboardingStore(trial, memory);
  const stop = onb.attach();
  return { trial, onb, saved, stop };
};

const run = (trial: TrialStore, result: TakeResult['result']) => {
  trial.setBet(trial.chips[0] ?? null);
  expect(trial.start()).toBe(true);
  trial.finish(take(result));
};

describe('startOnb', () => {
  const p = (o: { snap?: boolean; onb?: 0 | 1 | 2 | 3 | 4; exp?: { stim: 'sugar'; op: 'none' } } = {}) => ({
    snap: false,
    ...o,
  });
  it('opens on a first visit only', () => {
    expect(startOnb({ params: p(), done: false, journal: false })).toBe(1);
    expect(startOnb({ params: p(), done: true, journal: false })).toBe(0);
    // a returning visitor from before the onboarding already has results
    expect(startOnb({ params: p(), done: false, journal: true })).toBe(0);
    expect(startOnb({ params: p({ snap: true }), done: false, journal: false })).toBe(0);
    // a link to an experiment opens that experiment
    expect(startOnb({ params: p({ exp: { stim: 'sugar', op: 'none' } }), done: false, journal: false })).toBe(
      0,
    );
  });
  it('`?onb=` wins', () => {
    expect(startOnb({ params: p({ snap: true, onb: 3 }), done: true, journal: true })).toBe(3);
    expect(startOnb({ params: p({ onb: 0 }), done: false, journal: false })).toBe(0);
  });
});

describe('OnboardingStore', () => {
  it('walks the four steps: swatter, switch DNp01 off, swatter again, got it', () => {
    const { trial, onb, saved } = setup();
    onb.begin(1);
    expect(trial.pair).toEqual({ stim: 'swatter', op: 'none' });
    expect(trial.needsBet).toBe(true);
    run(trial, 'jump');
    expect(onb.step).toBe(2);
    onb.next();
    expect(onb.step).toBe(3);
    expect(trial.pair).toEqual({ stim: 'swatter', op: 'panic' });
    expect(trial.phase).toBe('setup');
    run(trial, 'hit');
    expect(onb.step).toBe(4);
    expect(trial.outcome?.unlocked?.id).toBe('swatter:panic');
    expect(saved.done).toBe(false);
    onb.finish();
    expect(onb.step).toBe(0);
    expect(saved.done).toBe(true);
  });

  it('skip leaves an empty setup and remembers', () => {
    const { trial, onb, saved } = setup();
    onb.begin(1);
    onb.skip();
    expect(onb.step).toBe(0);
    expect(trial.pair).toBeNull();
    expect(trial.op).toBe('none');
    expect(saved.done).toBe(true);
  });

  it('ends quietly when the visitor picks another pair', () => {
    const { trial, onb, saved } = setup();
    onb.begin(1);
    trial.setStim('sugar');
    expect(onb.step).toBe(0);
    expect(saved.done).toBe(true);
    expect(trial.pair).toEqual({ stim: 'sugar', op: 'none' });
  });

  it('a run aborted with «стоп» keeps the step', () => {
    const { trial, onb } = setup();
    onb.begin(1);
    trial.setBet(trial.chips[0] ?? null);
    trial.start();
    trial.stop();
    expect(onb.step).toBe(1);
  });

  it('restart stages step 1 again (the «?»), asking for a bet even if the pair was run', () => {
    const { trial, onb } = setup();
    onb.begin(1);
    run(trial, 'jump');
    onb.finish();
    onb.restart();
    expect(onb.step).toBe(1);
    expect(trial.pair).toEqual({ stim: 'swatter', op: 'none' });
    expect(trial.phase).toBe('setup');
    expect(trial.needsBet).toBe(true);
    run(trial, 'jump');
    expect(onb.step).toBe(2);
    expect(trial.needsBet).toBe(false);
  });

  it('a snap step stages its pair', () => {
    const { trial, onb } = setup();
    onb.begin(3);
    expect(trial.pair).toEqual({ stim: 'swatter', op: 'panic' });
    onb.begin(2);
    expect(trial.pair).toEqual({ stim: 'swatter', op: 'none' });
  });

  it('detaches', () => {
    const { trial, onb, stop } = setup();
    onb.begin(1);
    stop();
    run(trial, 'jump');
    expect(onb.step).toBe(1);
  });
});
