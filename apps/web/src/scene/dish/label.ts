/** The hologram label (SURGEON-SHAPE §Motion): leader draw, then the text, wall ms. */
const DRAW_MS = 300;
const TEXT_DELAY = 150;
const TEXT_MS = 200;
const HOLD_MS = 4000;
const FADE_MS = 400;
/** Fully shown at; gone at. */
export const LABEL_FULL_MS = TEXT_DELAY + TEXT_MS;
export const LABEL_MS = LABEL_FULL_MS + HOLD_MS + FADE_MS;

/** Label look at `ms` wall time since it was shown: leader drawn (0..1), text and overall opacity. */
export function labelAt(
  ms: number,
  reducedMotion: boolean,
): { leader: number; text: number; alpha: number } | null {
  if (ms < 0) return null;
  if (reducedMotion) return ms < LABEL_FULL_MS + HOLD_MS ? { leader: 1, text: 1, alpha: 1 } : null;
  if (ms >= LABEL_MS) return null;
  const u = Math.min(1, ms / DRAW_MS);
  const fade = ms - LABEL_FULL_MS - HOLD_MS;
  return {
    leader: 1 - (1 - u) ** 3,
    text: Math.max(0, Math.min(1, (ms - TEXT_DELAY) / TEXT_MS)),
    alpha: fade <= 0 ? 1 : 1 - fade / FADE_MS,
  };
}
