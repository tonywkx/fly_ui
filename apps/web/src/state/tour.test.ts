import { describe, expect, it } from 'vitest';
import { ExperimentStore } from './experiment';
import { PlaybackStore } from './playback';
import { panicRows, startStep, type TourState, TourStore, tourNext } from './tour';

const at = (step: TourState['step'], phase: TourState['phase'] = 'idle'): TourState => ({ step, phase });

describe('tourNext', () => {
  it('walks narration → see → scare → break → cheat sheet → off', () => {
    let s: TourState | null = at(0);
    const seen: (TourState | null)[] = [];
    const go = (e: Parameters<typeof tourNext>[1]) => {
      s = tourNext(s, e);
      seen.push(s);
    };
    go('next');
    go('next');
    go('ended');
    go('next');
    go('next');
    go('ended');
    go('next');
    go('next');
    expect(seen).toEqual([
      at(1),
      at(2, 'running'),
      at(2, 'done'),
      at(3),
      at(3, 'running'),
      at(3, 'done'),
      at(4),
      null,
    ]);
  });

  it('ignores next while a run plays; again replays a finished run', () => {
    expect(tourNext(at(2, 'running'), 'next')).toEqual(at(2, 'running'));
    expect(tourNext(at(3, 'done'), 'again')).toEqual(at(3, 'running'));
    expect(tourNext(at(1), 'again')).toEqual(at(1));
    expect(tourNext(at(1), 'ended')).toEqual(at(1));
  });

  it('skip ends the tour from anywhere; events after the end do nothing', () => {
    expect(tourNext(at(2, 'running'), 'skip')).toBeNull();
    expect(tourNext(null, 'next')).toBeNull();
  });
});

describe('startStep', () => {
  const base = { params: { snap: false }, seen: false, scenario: 'escape' };

  it('starts a first visit to escape at step 0', () => {
    expect(startStep(base)).toBe(0);
  });

  it('stays off once seen, on other scenarios, under snap, or with tour=0', () => {
    expect(startStep({ ...base, seen: true })).toBeNull();
    expect(startStep({ ...base, scenario: 'sugar' })).toBeNull();
    expect(startStep({ ...base, params: { snap: true } })).toBeNull();
    expect(startStep({ ...base, params: { snap: false, tour: 0 } })).toBeNull();
  });

  it('tour=<step> opens that step even when seen or under snap', () => {
    expect(startStep({ ...base, seen: true, params: { snap: true, tour: 3 } })).toBe(3);
    expect(startStep({ ...base, scenario: 'song', params: { snap: false, tour: 1 } })).toBeNull();
  });
});

describe('panicRows', () => {
  it('lists the scenario rows of type DNp01', () => {
    const meta = { n: 4, type: new Uint16Array([2, 0, 1, 0]), strings: { types: ['DNp01', 'TTMn', 'LC4'] } };
    expect(panicRows(meta)).toEqual([1, 3]);
    expect(panicRows({ ...meta, strings: { types: ['LC4'] } })).toEqual([]);
  });
});

describe('TourStore', () => {
  const setup = (seen = false) => {
    const playback = new PlaybackStore();
    const experiment = new ExperimentStore();
    const stored: string[] = [];
    const tour = new TourStore(playback, experiment, {
      seen: () => seen,
      markSeen: () => stored.push('seen'),
    });
    tour.setPanic([5, 6]);
    return { playback, experiment, tour, stored };
  };

  it('scare plays the baked run once at ¼×, its end shows the result', () => {
    const { playback, experiment, tour } = setup();
    tour.start(1);
    expect(playback.paused).toBe(true);
    expect(experiment.warm).toBe(false);
    tour.next();
    expect(experiment.warm).toBe(true);
    expect(tour.state).toEqual(at(2, 'running'));
    expect(playback.speed).toBe(0.25);
    expect(playback.once).toBe(true);
    expect(playback.paused).toBe(false);
    expect(playback.restartReq).toEqual({ baked: true });
    expect(tour.outcome).toBeNull();
    playback.finish({ at: 30, missed: false });
    expect(tour.state).toEqual(at(2, 'done'));
    expect(tour.outcome).toEqual({ at: 30, missed: false });
  });

  it('break silences every DNp01 and waits paused for the live sim', () => {
    const { playback, experiment, tour } = setup();
    tour.start(3);
    tour.next();
    expect([...experiment.silenced]).toEqual([5, 6]);
    expect(playback.paused).toBe(true);
    expect(tour.preparing).toBe(false);
    experiment.setLive('loading');
    expect(tour.preparing).toBe(true);
    experiment.setLive('on');
    expect(tour.preparing).toBe(false);
  });

  it('break with the live sim already on restarts it from 0, playing', () => {
    const { playback, experiment, tour } = setup();
    experiment.setLive('on');
    tour.start(3);
    tour.next();
    expect(playback.paused).toBe(false);
    expect(playback.restartReq).toEqual({ baked: false });
  });

  it('a failed live sim moves on to the cheat sheet', () => {
    const { experiment, tour } = setup();
    tour.start(3);
    tour.next();
    experiment.setLive('failed');
    expect(tour.state).toEqual(at(4));
  });

  it('the cheat sheet undoes the break: baked escape, paused at 0, 1×, looping; seen', () => {
    const { playback, experiment, tour, stored } = setup();
    tour.start(3);
    tour.next();
    playback.finish();
    tour.next();
    expect(tour.state).toEqual(at(4));
    expect(experiment.touched).toBe(false);
    expect(playback.speed).toBe(1);
    expect(playback.once).toBe(false);
    expect(playback.paused).toBe(true);
    expect(playback.restartReq).toEqual({ baked: true });
    expect(stored).toEqual(['seen']);
    expect(tour.active).toBe(true);
    tour.next();
    expect(tour.active).toBe(false);
  });

  it('skip during narration only marks seen; skip mid-tour restores the baked run', () => {
    const a = setup();
    a.tour.start(0);
    a.tour.skip();
    expect(a.tour.state).toBeNull();
    expect(a.stored).toEqual(['seen']);
    expect(a.playback.restartReq).toBeNull();

    const b = setup();
    b.tour.start(3);
    b.tour.next();
    b.tour.skip();
    expect(b.experiment.touched).toBe(false);
    expect(b.playback.once).toBe(false);
    expect(b.playback.restartReq).toEqual({ baked: true });
  });
});
