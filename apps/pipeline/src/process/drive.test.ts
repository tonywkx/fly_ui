import { netFromEdges, type Spikes } from '@fly/sim';
import { describe, expect, test } from 'vitest';
import { firstSpike, inputDrive } from './drive';

const spikes = (events: [number, number][]): Spikes => ({
  count: events.length,
  t: Float32Array.from(events, ([t]) => t),
  id: Uint32Array.from(events, ([, id]) => id),
});

// 0 → 3 (+2), 1 → 3 (−1), 1 → 4 (+5), 2 → 4 (+1), 0 → 2 (+7)
const net = netFromEdges(5, [
  [0, 3, 2],
  [0, 2, 7],
  [1, 3, -1],
  [1, 4, 5],
  [2, 4, 1],
]);

describe('inputDrive', () => {
  test('spike count × signed weight into the targets, per presynaptic neuron', () => {
    const d = inputDrive(
      net,
      spikes([
        [1, 0],
        [2, 0],
        [3, 1],
      ]),
      [3],
    );
    expect(Array.from(d)).toEqual([4, -1, 0, 0, 0]);
  });

  test('sums over several targets, ignores edges to non-targets', () => {
    const d = inputDrive(
      net,
      spikes([
        [1, 0],
        [1, 1],
        [1, 2],
      ]),
      [3, 4],
    );
    expect(Array.from(d)).toEqual([2, 4, 1, 0, 0]);
  });

  test('only spikes before untilMs count', () => {
    const d = inputDrive(
      net,
      spikes([
        [1, 0],
        [5, 0],
        [9, 0],
      ]),
      [3],
      6,
    );
    expect(d[0]).toBe(4);
  });

  test('no spikes → zero drive', () => {
    expect(inputDrive(net, spikes([]), [3, 4]).every((x) => x === 0)).toBe(true);
  });
});

describe('firstSpike', () => {
  test('earliest spike among the given neurons, Infinity when silent', () => {
    const s = spikes([
      [4, 2],
      [1.5, 0],
      [3, 3],
      [2, 3],
    ]);
    expect(firstSpike(s, [3, 4])).toBe(2);
    expect(firstSpike(s, [4])).toBe(Number.POSITIVE_INFINITY);
  });
});
