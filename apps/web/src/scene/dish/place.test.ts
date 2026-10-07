import { ARENA_R, type Item } from '@fly/sim';
import { describe, expect, it } from 'vitest';
import { ahead, floorHit, inDish, itemAt } from './place';

const item = (id: number, x: number, y: number): Item => ({ id, kind: 'sugar', x, y, heading: 0 });

describe('place', () => {
  it('hits the floor where the ray crosses y = 0, scene −z = world y', () => {
    expect(floorHit({ x: 0, y: 10, z: 0 }, { x: 0.5, y: -1, z: -0.25 })).toEqual({ x: 5, y: 2.5 });
    expect(floorHit({ x: 0, y: 10, z: 0 }, { x: 0, y: 1, z: 0 })).toBeNull();
    expect(inDish({ x: ARENA_R - 0.1, y: 0 })).toBe(true);
    expect(inDish({ x: ARENA_R, y: 1 })).toBe(false);
  });

  it('picks the nearest item within reach', () => {
    const items = [item(1, 0, 0), item(2, 1, 0)];
    expect(itemAt(items, 0.7, 0)?.id).toBe(2);
    expect(itemAt(items, 5, 5)).toBeNull();
  });

  it('finds a free spot ahead of the fly, inside the dish and clear of items', () => {
    const fly = { x: 0, y: 0, heading: 0 };
    expect(ahead(fly, [])).toEqual({ x: 3, y: 0 });
    const p = ahead(fly, [item(1, 3, 0)]);
    expect(Math.hypot(p.x - 3, p.y)).toBeGreaterThan(1);
    const wall = ahead({ x: ARENA_R - 1, y: 0, heading: 0 }, []);
    expect(Math.hypot(wall.x, wall.y)).toBeLessThan(ARENA_R - 0.9);
  });
});
