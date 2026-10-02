import { describe, expect, it } from 'vitest';
import { netFromEdges } from './net';
import { applyOverrides } from './overrides';

describe('applyOverrides', () => {
  const types = ['GF', 'GF', 'TTMn', 'TTMn', 'X'];
  const net = netFromEdges(5, [
    [0, 2, 1],
    [0, 4, 2],
    [1, 3, -1],
    [4, 2, 3],
  ]);

  it('sets the weight of existing pre-type → post-type edges only', () => {
    const out = applyOverrides(net, types, [{ pre: 'GF', post: 'TTMn', mV: 10 }]);
    expect([...out.w]).toEqual([10, 2, 10, 3]);
    expect(out.cols).toBe(net.cols);
  });

  it('does not mutate the input net', () => {
    applyOverrides(net, types, [{ pre: 'GF', post: 'TTMn', mV: 10 }]);
    expect([...net.w]).toEqual([1, 2, -1, 3]);
  });

  it('throws when an override matches no edge', () => {
    expect(() => applyOverrides(net, types, [{ pre: 'TTMn', post: 'GF', mV: 10 }])).toThrow(/TTMn → GF/);
  });
});
