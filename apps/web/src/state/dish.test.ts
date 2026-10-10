import { describe, expect, it } from 'vitest';
import { DishStore } from './dish';

const store = () => ({ s: new DishStore() });

describe('DishStore puppet', () => {
  it('holds keys while pressed and lets all go', () => {
    const { s } = store();
    s.pull('up', true);
    s.pull('left', true);
    s.pull('up', false);
    expect([...s.pulls]).toEqual(['left']);
    s.setPulls();
    expect(s.pulls.size).toBe(0);
  });
});

describe('DishStore phone sheet', () => {
  it('opening a card shows the operations tab', () => {
    const { s } = store();
    expect(s.tab).toBe('items');
    s.setTab('puppet');
    s.setOpen('moon');
    expect(s.tab).toBe('ops');
    s.setOpen(null);
    expect(s.tab).toBe('ops');
  });
});
