import { describe, expect, it } from 'vitest';
import { loadLine, loadPct, startWelcome, type WelcomeMemory, WelcomeStore } from './welcome';

describe('startWelcome', () => {
  const p = (o: Partial<Parameters<typeof startWelcome>[0]['params']> = {}) => ({
    snap: false,
    view: 'dish' as const,
    ...o,
  });
  it('full on a first visit, short once welcomed', () => {
    expect(startWelcome({ params: p(), welcomed: false })).toBe('full');
    expect(startWelcome({ params: p(), welcomed: true })).toBe('short');
  });
  it('off for snaps, experiment links, the brain and the flight out of it', () => {
    expect(startWelcome({ params: p({ snap: true }), welcomed: false })).toBe('off');
    expect(startWelcome({ params: p({ exp: { stim: 'sugar', op: 'none' } }), welcomed: false })).toBe('off');
    expect(startWelcome({ params: p({ from: 'brain' }), welcomed: false })).toBe('off');
    expect(startWelcome({ params: p({ view: 'brain' }), welcomed: false })).toBe('off');
  });
  it('?welcome= wins', () => {
    expect(startWelcome({ params: p({ snap: true, welcome: 'full' }), welcomed: true })).toBe('full');
    expect(startWelcome({ params: p({ welcome: 'short' }), welcomed: false })).toBe('short');
    expect(startWelcome({ params: p({ welcome: 'off' }), welcomed: false })).toBe('off');
  });
});

describe('WelcomeStore', () => {
  const setup = () => {
    const saved = { welcomed: false };
    const memory: WelcomeMemory = { welcomed: () => saved.welcomed, save: () => (saved.welcomed = true) };
    const restarts = { n: 0 };
    const w = new WelcomeStore({ restart: () => restarts.n++ }, memory);
    return { w, saved, restarts };
  };

  it('«Начать» closes the full welcome and remembers the visit', () => {
    const { w, saved, restarts } = setup();
    w.open('full');
    w.start();
    expect(w.mode).toBe('off');
    expect(saved.welcomed).toBe(true);
    // the visit's own welcome: onboarding starts by itself (startOnb), no restart
    expect(restarts.n).toBe(0);
  });

  it('the short splash leaving remembers nothing', () => {
    const { w, saved } = setup();
    w.open('short');
    w.close();
    expect(w.mode).toBe('off');
    expect(saved.welcomed).toBe(false);
  });

  it('Esc on the full welcome closes and remembers', () => {
    const { w, saved } = setup();
    w.open('full');
    w.close();
    expect(w.mode).toBe('off');
    expect(saved.welcomed).toBe(true);
  });

  it('«?» reopens the full one; «Начать» then restarts the onboarding, Esc just closes', () => {
    const { w, restarts } = setup();
    w.reopen();
    expect(w.mode).toBe('full');
    expect(w.again).toBe(true);
    w.start();
    expect(restarts.n).toBe(1);
    expect(w.again).toBe(false);
    w.reopen();
    w.close();
    expect(w.mode).toBe('off');
    expect(restarts.n).toBe(1);
  });
});

describe('loadPct', () => {
  it('an integer percentage, never 100 before the brain is up', () => {
    expect(loadPct(0, false)).toBe(0);
    expect(loadPct(0.426, false)).toBe(42);
    expect(loadPct(1, false)).toBe(99);
    expect(loadPct(1.3, false)).toBe(99);
  });
  it('ready wins; unknown total = no number', () => {
    expect(loadPct(0.5, true)).toBe('ready');
    expect(loadPct(null, true)).toBe('ready');
    expect(loadPct(null, false)).toBeNull();
  });
});

describe('loadLine', () => {
  it('names the progress line by state', () => {
    expect(loadLine(42, false)).toEqual({ key: 'welcome.loading', pct: 42 });
    expect(loadLine(null, false)).toEqual({ key: 'welcome.loadingAny' });
    expect(loadLine('ready', false)).toEqual({ key: 'welcome.ready' });
  });
  it('a failed load wins until the brain is up', () => {
    expect(loadLine(42, true)).toEqual({ key: 'welcome.failed' });
    expect(loadLine(null, true)).toEqual({ key: 'welcome.failed' });
    expect(loadLine('ready', true)).toEqual({ key: 'welcome.ready' });
  });
});
