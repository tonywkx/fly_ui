import { describe, expect, it } from 'vitest';
import { ExperimentStore, keyAction, STIM_RANGE } from './experiment';

describe('ExperimentStore', () => {
  it('selects and clears a neuron', () => {
    const x = new ExperimentStore();
    x.select(3);
    expect(x.selected).toBe(3);
    x.select(null);
    expect(x.selected).toBeNull();
  });

  it('toggles stimulus and silencing per row, independently', () => {
    const x = new ExperimentStore();
    x.toggleStim(2);
    x.toggleSilence(2);
    x.toggleSilence(5);
    expect([...x.stimulated]).toEqual([2]);
    expect([...x.silenced]).toEqual([2, 5]);
    x.toggleSilence(2);
    x.toggleStim(2);
    expect(x.stimulated.size).toBe(0);
    expect([...x.silenced]).toEqual([5]);
  });

  it('counts as touched once anything is stimulated or silenced', () => {
    const x = new ExperimentStore();
    x.select(1);
    expect(x.touched).toBe(false);
    x.toggleStim(1);
    expect(x.touched).toBe(true);
  });

  it('clear drops manipulations and keeps the selection', () => {
    const x = new ExperimentStore();
    x.select(4);
    x.toggleStim(1);
    x.toggleSilence(2);
    x.clear();
    expect(x.touched).toBe(false);
    expect(x.selected).toBe(4);
  });

  it('issues a fresh fly request every time', () => {
    const x = new ExperimentStore();
    x.flyTo(2);
    const first = x.fly;
    x.flyTo(2);
    expect(x.fly).toEqual({ row: 2 });
    expect(x.fly).not.toBe(first);
  });

  it('click applies the active tool', () => {
    const x = new ExperimentStore();
    x.apply(3);
    expect(x.selected).toBe(3);
    x.setTool('stimulate');
    x.apply(4);
    x.apply(null);
    expect([...x.stimulated]).toEqual([4]);
    expect(x.selected).toBe(3);
    x.apply(4);
    expect(x.stimulated.size).toBe(0);
    x.setTool('silence');
    x.apply(5);
    expect([...x.silenced]).toEqual([5]);
    x.setTool('select');
    x.apply(null);
    expect(x.selected).toBeNull();
  });

  it('paint adds with the brush tools and never toggles off', () => {
    const x = new ExperimentStore();
    x.paint(1);
    expect(x.touched).toBe(false);
    x.setTool('stimulate');
    x.paint(1);
    x.paint(1);
    x.paint(2);
    expect([...x.stimulated]).toEqual([1, 2]);
    x.setTool('silence');
    x.paint(2);
    expect([...x.silenced]).toEqual([2]);
  });

  it('places up to four probes in stable slots', () => {
    const x = new ExperimentStore();
    x.setTool('electrode');
    for (const r of [10, 11, 12, 13]) expect(x.apply(r)).toBe(true);
    expect(x.probesFull).toBe(true);
    expect(x.apply(14)).toBe(false);
    x.apply(11); // removes, slot 1 frees up, the others keep their slots
    expect(x.probes).toEqual([10, null, 12, 13]);
    x.apply(14);
    expect(x.probes).toEqual([10, 14, 12, 13]);
    x.removeProbe(0);
    expect(x.probes).toEqual([null, 14, 12, 13]);
  });

  it('clamps stimulus settings to their ranges', () => {
    const x = new ExperimentStore();
    x.setStim({ hz: 1e6 });
    expect(x.stim).toEqual({ hz: STIM_RANGE.hz[1], gain: 1 });
    x.setStim({ gain: 0 });
    expect(x.stim.gain).toBe(STIM_RANGE.gain[0]);
  });

  it('escape leaves the tool first, then the selection', () => {
    const x = new ExperimentStore();
    x.select(2);
    x.setTool('silence');
    expect(x.escape()).toBe(true);
    expect(x.tool).toBe('select');
    expect(x.selected).toBe(2);
    expect(x.escape()).toBe(true);
    expect(x.selected).toBeNull();
    expect(x.escape()).toBe(false);
  });
});

describe('keyAction', () => {
  const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
    keyAction({ key: k, ...mods } as KeyboardEvent);

  it('maps tool keys case-insensitively and Escape', () => {
    expect(key('v')).toBe('select');
    expect(key('S')).toBe('stimulate');
    expect(key('x')).toBe('silence');
    expect(key('e')).toBe('electrode');
    expect(key('Escape')).toBe('escape');
    expect(key('q')).toBeNull();
  });

  it('ignores modified keys and repeats', () => {
    expect(key('s', { metaKey: true })).toBeNull();
    expect(key('s', { ctrlKey: true })).toBeNull();
    expect(key('s', { altKey: true })).toBeNull();
    expect(key('s', { repeat: true })).toBeNull();
  });
});
