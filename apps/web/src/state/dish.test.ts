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
  it('«Положить» is a flag over the card tabs; opening a card leaves it', () => {
    const { s } = store();
    expect(s.put).toBe(false);
    s.setPut(true);
    s.setOpen('moon');
    expect(s.put).toBe(true);
    s.setPut(false);
    expect(s.put).toBe(false);
  });
});
