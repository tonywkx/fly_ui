import { describe, expect, it } from 'vitest';
import { cardView } from './cardView';

const quiet = { outcome: null, preparing: false, phone: false };
const jumped = { ...quiet, outcome: { at: 29.734, missed: false } };
const stayed = { ...quiet, outcome: { at: 100, missed: true } };

describe('cardView', () => {
  it('has no card without a tour or during the narration', () => {
    expect(cardView(null, quiet)).toBeNull();
    expect(cardView({ step: 0, phase: 'idle' }, quiet)).toBeNull();
  });

  it('step 1: what you see, the count and one pill', () => {
    expect(cardView({ step: 1, phase: 'idle' }, quiet)).toEqual({
      step: 1,
      title: { key: 'tour.see.title' },
      body: 'tour.see.body',
      count: true,
      pill: 'tour.see.cta',
    });
  });

  it('collapses to one line while a run plays (phone points up)', () => {
    expect(cardView({ step: 2, phase: 'running' }, quiet)).toEqual({ step: 2, line: 'tour.scare.running' });
    expect(cardView({ step: 2, phase: 'running' }, { ...quiet, phone: true })?.line).toBe(
      'tour.scare.runningPhone',
    );
    expect(cardView({ step: 3, phase: 'running' }, quiet)?.line).toBe('tour.break.running');
    expect(cardView({ step: 3, phase: 'running' }, { ...quiet, preparing: true })?.line).toBe(
      'tour.preparing',
    );
  });

  it('step 2 done: takeoff time to one decimal, again + break it', () => {
    expect(cardView({ step: 2, phase: 'done' }, jumped)).toEqual({
      step: 2,
      title: { key: 'tour.scare.title', vars: { ms: 29.7 } },
      body: 'tour.scare.body',
      ghost: 'tour.again',
      pill: 'tour.scare.cta',
    });
  });

  it('step 3: setup, then no takeoff', () => {
    expect(cardView({ step: 3, phase: 'idle' }, quiet)).toMatchObject({
      title: { key: 'tour.break.title' },
      pill: 'tour.break.cta',
    });
    expect(cardView({ step: 3, phase: 'done' }, stayed)).toEqual({
      step: 3,
      title: { key: 'tour.broken.title' },
      body: 'tour.broken.body',
      ghost: 'tour.again',
      pill: 'tour.broken.cta',
    });
  });

  it('says so when the broken fly jumped after all', () => {
    const v = cardView({ step: 3, phase: 'done' }, jumped);
    expect(v?.title?.key).toBe('tour.scare.title');
    expect(v?.body).toBeUndefined();
  });

  it('step 4: key list on desktop, short line on phones', () => {
    expect(cardView({ step: 4, phase: 'idle' }, quiet)).toMatchObject({
      sheet: 'keys',
      pill: 'tour.end.cta',
    });
    expect(cardView({ step: 4, phase: 'idle' }, { ...quiet, phone: true })).toMatchObject({
      sheet: 'phone',
      pill: 'tour.end.phoneCta',
    });
  });
});
