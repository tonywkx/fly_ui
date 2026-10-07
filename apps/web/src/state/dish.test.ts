import { describe, expect, it } from 'vitest';
import type { Outcome } from '../scene/dish/verdict';
import { DishStore, type LevelMemory } from './dish';

function store(init = { solved: [] as number[], closed: false }) {
  const mem = { ...init };
  const memory: LevelMemory = { load: () => mem, save: (m) => Object.assign(mem, m) };
  return { s: new DishStore(memory), mem };
}

const hit: Outcome = { line: 'verdict', hz: 44, ms: null, hit: true };

describe('DishStore puzzles', () => {
  it('opens with the first unsolved puzzle unless closed, set up or asked', () => {
    expect(store().s.firstLevel(undefined, false)).toBe(0);
    expect(store({ solved: [0, 1], closed: false }).s.firstLevel(undefined, false)).toBe(2);
    expect(store({ solved: [0, 1, 2, 3], closed: false }).s.firstLevel(undefined, false)).toBeNull();
    expect(store({ solved: [], closed: true }).s.firstLevel(undefined, false)).toBeNull();
    expect(store().s.firstLevel(undefined, true)).toBeNull();
    expect(store({ solved: [], closed: true }).s.firstLevel(3, false)).toBe(2);
    expect(store().s.firstLevel(0, false)).toBeNull();
  });

  it('a start clears the operations, closes the cards and hands the tool', () => {
    const { s } = store();
    s.toggleOp('moon');
    s.startLevel(0);
    expect([...s.ops]).toEqual([]);
    expect(s.open).toBeNull();
    expect(s.hand).toBe('swatter');
    expect(s.round).toBe(1);
  });

  it('the solving outcome wins once and is remembered', () => {
    const { s, mem } = store();
    s.startLevel(0);
    s.setNow('panic', { ...hit, hit: false });
    expect(s.won).toBeNull();
    s.setNow('panic', hit);
    expect(s.won).toEqual(hit);
    expect(mem.solved).toEqual([0]);
    s.setNow('panic', { ...hit, hz: 10 });
    expect(s.won?.hz).toBe(44);
    s.nextLevel();
    expect(s.level).toBe(1);
    expect(s.won).toBeNull();
  });

  it('the last hint opens the answer card; closing is remembered', () => {
    const { s, mem } = store();
    s.startLevel(1);
    s.showHint();
    s.showHint();
    expect(s.open).toBeNull();
    s.showHint();
    expect(s.open).toBe('sugar');
    s.closeLevels();
    expect(s.level).toBeNull();
    expect(mem.closed).toBe(true);
  });
});
