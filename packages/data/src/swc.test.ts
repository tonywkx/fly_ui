import { describe, expect, test } from 'vitest';
import { childrenOf, parseSwc, type Skeleton, SwcError } from './swc';

const swc = (...rows: string[]) => rows.join('\n');
const parents = (sk: Skeleton) => Array.from(sk.parent);
const xs = (sk: Skeleton) => Array.from(sk.pos.filter((_, i) => i % 3 === 0));

describe('parseSwc', () => {
  test('linear chain: positions, radii, parents', () => {
    const sk = parseSwc(swc('1 1 0 0 0 5 -1', '2 0 10 0 0 2 1', '3 0 20 1 2 1 2'));
    expect(Array.from(sk.pos)).toEqual([0, 0, 0, 10, 0, 0, 20, 1, 2]);
    expect(Array.from(sk.radius)).toEqual([5, 2, 1]);
    expect(parents(sk)).toEqual([-1, 0, 1]);
    expect(Array.from(sk.type)).toEqual([1, 0, 0]);
    expect(sk.soma).toBe(0);
  });

  test('ignores comments, blank lines, tabs and CRLF', () => {
    const text = '# header\r\n\r\n1\t1\t0 0 0 5 -1  \r\n  # mid\r\n2 0\t10 0 0\t2\t1\r\n';
    const sk = parseSwc(text);
    expect(xs(sk)).toEqual([0, 10]);
    expect(parents(sk)).toEqual([-1, 0]);
  });

  test('out-of-order ids yield topological order', () => {
    const sk = parseSwc(swc('7 0 20 0 0 1 3', '3 0 10 0 0 1 9', '9 1 0 0 0 5 -1'));
    expect(xs(sk)).toEqual([0, 10, 20]);
    expect(parents(sk)).toEqual([-1, 0, 1]);
  });

  test('parent always precedes child', () => {
    const sk = parseSwc(
      swc('5 0 4 0 0 1 2', '1 1 0 0 0 9 -1', '4 0 3 0 0 1 2', '2 0 1 0 0 1 1', '3 0 2 0 0 1 1'),
    );
    sk.parent.forEach((p, i) => {
      expect(p).toBeLessThan(i);
    });
  });

  test('soma from type=1 (largest radius among them)', () => {
    const sk = parseSwc(swc('1 0 0 0 0 9 -1', '2 1 10 0 0 3 1', '3 1 20 0 0 4 2'));
    expect(sk.soma).toBe(0);
    expect(xs(sk)[0]).toBe(20);
  });

  test('soma falls back to max radius when untyped', () => {
    const sk = parseSwc(swc('1 0 0 0 0 1 -1', '2 0 10 0 0 7 1', '3 0 20 0 0 2 2'));
    expect(sk.soma).toBe(0);
    expect(xs(sk)[0]).toBe(10);
    expect(sk.radius[0]).toBe(7);
  });

  test('reroots soma component at the soma', () => {
    // chain 0 - 10 - 20 rooted at x=0, soma in the middle
    const sk = parseSwc(swc('1 0 0 0 0 1 -1', '2 1 10 0 0 5 1', '3 0 20 0 0 1 2'));
    expect(xs(sk)[0]).toBe(10);
    expect(parents(sk)).toEqual([-1, 0, 0]);
    expect(xs(sk).slice(1).sort()).toEqual([0, 20]);
  });

  test('keeps extra components as separate roots, soma first', () => {
    const sk = parseSwc(swc('1 0 100 0 0 1 -1', '2 0 110 0 0 1 1', '3 1 0 0 0 5 -1', '4 0 10 0 0 1 3'));
    expect(sk.soma).toBe(0);
    expect(xs(sk)).toEqual([0, 10, 100, 110]);
    expect(parents(sk)).toEqual([-1, 0, -1, 2]);
  });

  test.each([
    ['empty input', '# only a comment\n\n'],
    ['duplicate id', swc('1 0 0 0 0 1 -1', '1 0 1 0 0 1 -1')],
    ['missing parent', swc('1 0 0 0 0 1 -1', '2 0 1 0 0 1 42')],
    ['cycle', swc('1 0 0 0 0 1 -1', '2 0 1 0 0 1 3', '3 0 2 0 0 1 2')],
    ['too few columns', swc('1 0 0 0 0 1')],
    ['non-numeric field', swc('1 0 0 0 abc 1 -1')],
  ])('rejects %s', (_, text) => {
    expect(() => parseSwc(text)).toThrow(SwcError);
  });
});

describe('childrenOf', () => {
  test('CSR adjacency on a Y branch', () => {
    // soma -> a -> {b, c}
    const sk = parseSwc(swc('1 1 0 0 0 5 -1', '2 0 1 0 0 1 1', '3 0 2 1 0 1 2', '4 0 2 -1 0 1 2'));
    const { offsets, children } = childrenOf(sk);
    expect(Array.from(offsets)).toEqual([0, 1, 3, 3, 3]);
    expect(Array.from(children)).toEqual([1, 2, 3]);
  });
});
