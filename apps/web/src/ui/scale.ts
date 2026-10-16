import { type Lang, lang, plural, t } from '../i18n';

/** A blink at the low end of its 100–400 ms range (SURGEON-SHAPE §Scale): the ratio never overstates. */
const BLINK_MS = 100;
/** Up to here a latency reads as «N× faster»; past `ABOUT` it gets no comparison. */
const FASTER = 50;
const ABOUT = 400;

/** How many times faster than a blink, rounded down. */
export const blinkRatio = (ms: number): number => Math.floor(BLINK_MS / ms);

/** «в 12 раз быстрее моргания» / «примерно как моргание»; null with no latency or past 400 ms. */
export function blink(ms: number | null, l: Lang = lang()): string | null {
  if (ms === null || ms <= 0 || ms > ABOUT) return null;
  return ms <= FASTER
    ? plural('scale.blink', blinkRatio(ms), undefined, l)
    : t('scale.blinkAbout', undefined, l);
}

/** «8 мс — в 12 раз быстрее моргания» (plain text, for the live region); null with no comparison. */
export function scaleLine(ms: number | null, l: Lang = lang()): string | null {
  const cmp = blink(ms, l);
  return cmp === null ? null : t('scale.line', { ms: ms as number, cmp }, l);
}
