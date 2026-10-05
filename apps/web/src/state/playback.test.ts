import { describe, expect, it } from 'vitest';
import { onceRate, PlaybackStore, playbackKey, SIM_MS_PER_S, SPEEDS, STEP_MS } from './playback';

const store = (start = 0, end = 300) => {
  const p = new PlaybackStore();
  p.setRange(start, end);
  return p;
};

describe('PlaybackStore', () => {
  it('toggles pause', () => {
    const p = store();
    p.toggle();
    expect(p.paused).toBe(true);
    p.toggle();
    expect(p.paused).toBe(false);
  });

  it('steps through the speeds and stops at both ends', () => {
    const p = store();
    expect(p.speed).toBe(1);
    expect(p.rate).toBe(SIM_MS_PER_S);
    for (let i = 0; i < SPEEDS.length + 2; i++) p.slower();
    expect(p.speed).toBe(SPEEDS[SPEEDS.length - 1]);
    for (let i = 0; i < SPEEDS.length + 2; i++) p.faster();
    expect(p.speed).toBe(1);
    p.setSpeed(0.25);
    expect(p.rate).toBe(SIM_MS_PER_S / 4);
  });

  it('hands a seek over once, clamped to the seekable range', () => {
    const p = store(100, 300);
    p.seek(50);
    expect(p.takeSeek()).toBe(100);
    expect(p.takeSeek()).toBeNull();
    p.seek(1000);
    expect(p.takeSeek()).toBe(300);
  });

  it('steps pause and accumulate before the scene takes them', () => {
    const p = store();
    p.clock.t = 40;
    p.step(1);
    p.step(1);
    expect(p.paused).toBe(true);
    expect(p.takeSeek()).toBe(40 + 2 * STEP_MS);
    p.clock.t = 42;
    p.step(-1);
    expect(p.takeSeek()).toBe(42 - STEP_MS);
  });

  it('play-once: finish pauses and marks the run ended', () => {
    const p = store();
    p.setOnce(true);
    p.finish({ at: 30, missed: false });
    expect(p.paused).toBe(true);
    expect(p.ended).toBe(true);
    expect(p.last).toEqual({ at: 30, missed: false });
    p.restart();
    expect(p.last).toBeNull();
  });

  it('restart plays from 0 with a fresh request each time', () => {
    const p = store(0, 300);
    p.setPaused(true);
    p.finish();
    p.restart();
    const first = p.restartReq;
    expect(first).toEqual({ baked: false });
    expect(p.ended).toBe(false);
    expect(p.paused).toBe(false);
    expect(p.takeSeek()).toBe(0);
    p.restart({ baked: true, paused: true });
    expect(p.restartReq).not.toBe(first);
    expect(p.restartReq).toEqual({ baked: true });
    expect(p.paused).toBe(true);
  });

  it('play after an ended run starts it again', () => {
    const p = store();
    p.setOnce(true);
    p.finish();
    p.toggle();
    expect(p.paused).toBe(false);
    expect(p.ended).toBe(false);
    expect(p.takeSeek()).toBe(0);
  });

  it('runs a key action', () => {
    const p = store();
    p.run('toggle');
    expect(p.paused).toBe(true);
    p.run('slower');
    expect(p.speed).toBe(SPEEDS[1]);
    p.run('faster');
    expect(p.speed).toBe(1);
  });
});

describe('playbackKey', () => {
  const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
    playbackKey({ key: k, ...mods } as KeyboardEvent);

  it('maps Space , . [ ]', () => {
    expect(key(' ')).toBe('toggle');
    expect(key(',')).toBe('back');
    expect(key('.')).toBe('forward');
    expect(key('[')).toBe('slower');
    expect(key(']')).toBe('faster');
    expect(key('v')).toBeNull();
  });

  it('ignores modified keys; only steps auto-repeat', () => {
    expect(key(' ', { metaKey: true })).toBeNull();
    expect(key('.', { ctrlKey: true })).toBeNull();
    expect(key(' ', { repeat: true })).toBeNull();
    expect(key(']', { repeat: true })).toBeNull();
    expect(key('.', { repeat: true })).toBe('forward');
  });
});

describe('onceRate', () => {
  it('a broken story plays out at 1× at least', () => {
    expect(onceRate(SIM_MS_PER_S / 4, false)).toBe(SIM_MS_PER_S / 4);
    expect(onceRate(SIM_MS_PER_S / 4, true)).toBe(SIM_MS_PER_S);
    expect(onceRate(SIM_MS_PER_S * 2, true)).toBe(SIM_MS_PER_S * 2);
  });
});
