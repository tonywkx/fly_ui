/** Uniform [0, 1) source. The sim takes one in, never touches Math.random. */
export type Rng = () => number;

/** mulberry32: tiny 32-bit seeded PRNG, plenty for Bernoulli Poisson draws. */
export function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
