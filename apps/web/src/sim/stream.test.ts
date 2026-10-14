import { describe, expect, it } from 'vitest';
import { readBytes } from './stream';

const streamed = (parts: number[][]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const p of parts) c.enqueue(Uint8Array.from(p));
        c.close();
      },
    }),
  );

describe('readBytes', () => {
  it('returns the whole body and counts bytes as they arrive', async () => {
    const seen: number[] = [];
    const buf = await readBytes(streamed([[1, 2], [3], [4, 5, 6]]), (n) => seen.push(n));
    expect([...new Uint8Array(buf)]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(seen).toEqual([2, 3, 6]);
  });

  it('a response without a body stream still reads', async () => {
    const seen: number[] = [];
    const buf = await readBytes(new Response(null), (n) => seen.push(n));
    expect(buf.byteLength).toBe(0);
  });
});
