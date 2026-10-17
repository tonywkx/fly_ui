/** Normalised device coords (−1..1, y up) → canvas px (`w` × `h`, y down). */
export function ndcToPx(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return { x: ((x + 1) / 2) * w, y: ((1 - y) / 2) * h };
}
