import { describe, expect, test } from 'vitest';
import { kStrongestPaths, type TypeEdge } from './paths';

// costs (1/weight): A-B-D 0.2 · A-D 0.5 · A-C-D 1.01
const edges: TypeEdge[] = [
  { from: 'A', to: 'B', weight: 10 },
  { from: 'B', to: 'D', weight: 10 },
  { from: 'A', to: 'C', weight: 100 },
  { from: 'C', to: 'D', weight: 1 },
  { from: 'A', to: 'D', weight: 2 },
  { from: 'D', to: 'A', weight: 50 },
];
const nodes = (r: ReturnType<typeof kStrongestPaths>) => r.map((p) => p.nodes.join('>'));

describe('kStrongestPaths', () => {
  test('orders paths by summed 1/weight', () => {
    expect(nodes(kStrongestPaths(edges, ['A'], ['D'], { k: 5, maxHops: 4 }))).toEqual([
      'A>B>D',
      'A>D',
      'A>C>D',
    ]);
  });

  test('k limits the result and reports weights', () => {
    const [best, ...rest] = kStrongestPaths(edges, ['A'], ['D'], { k: 1, maxHops: 4 });
    expect(rest).toHaveLength(0);
    expect(best).toMatchObject({ nodes: ['A', 'B', 'D'], weights: [10, 10], bottleneck: 10 });
    expect(best?.cost).toBeCloseTo(0.2);
  });

  test('maxHops cuts long paths', () => {
    expect(nodes(kStrongestPaths(edges, ['A'], ['D'], { k: 5, maxHops: 1 }))).toEqual(['A>D']);
  });

  test('paths are simple and end at the first target reached', () => {
    const r = kStrongestPaths(edges, ['D'], ['B'], { k: 10, maxHops: 6 });
    expect(nodes(r)).toEqual(['D>A>B']);
  });

  test('multiple sources and targets', () => {
    const r = kStrongestPaths(edges, ['A', 'C'], ['B', 'D'], { k: 10, maxHops: 3 });
    expect(nodes(r)).toEqual(['A>B', 'A>D', 'C>D', 'A>C>D']);
  });

  test('no path → empty', () => {
    expect(kStrongestPaths(edges, ['A'], ['Z'], { k: 3, maxHops: 4 })).toEqual([]);
  });
});
