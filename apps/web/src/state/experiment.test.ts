import { describe, expect, it } from 'vitest';
import { ExperimentStore } from './experiment';

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
});
