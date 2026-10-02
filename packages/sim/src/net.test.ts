import { describe, expect, it } from 'vitest';
import { netFromCsr, netFromEdges } from './net';

describe('netFromCsr', () => {
  it('signs weights by the presynaptic neuron and scales by wSyn', () => {
    const csr = {
      offsets: Uint32Array.from([0, 2, 3, 4]),
      cols: Uint32Array.from([1, 2, 0, 1]),
      weight: Uint16Array.from([10, 5, 7, 9]),
    };
    const net = netFromCsr(csr, Int8Array.from([1, -1, 0]), 0.5);
    expect(net.n).toBe(3);
    expect([...net.cols]).toEqual([1, 2, 0, 1]);
    expect([...net.w]).toEqual([5, 2.5, -3.5, 0]);
  });
});

describe('netFromEdges', () => {
  it('groups edges by pre, keeping insertion order within a row', () => {
    const net = netFromEdges(3, [
      [2, 0, 1],
      [0, 2, -4],
      [0, 1, 3],
    ]);
    expect([...net.offsets]).toEqual([0, 2, 2, 3]);
    expect([...net.cols]).toEqual([2, 1, 0]);
    expect([...net.w]).toEqual([-4, 3, 1]);
  });
});
