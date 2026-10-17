import { describe, expect, it } from 'vitest';
import { ndcToPx } from './screen';

describe('ndcToPx', () => {
  it('maps the corners and centre, y down', () => {
    expect(ndcToPx(-1, 1, 800, 600)).toEqual({ x: 0, y: 0 });
    expect(ndcToPx(1, -1, 800, 600)).toEqual({ x: 800, y: 600 });
    expect(ndcToPx(0, 0, 800, 600)).toEqual({ x: 400, y: 300 });
  });
});
