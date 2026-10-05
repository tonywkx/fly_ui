import type { Key, Vars } from '@/i18n';
import type { LastBeat } from '@/state/playback';
import type { TourState } from '@/state/tour';

export interface Text {
  key: Key;
  vars?: Vars;
}

/** What the tour card shows (docs/TOUR.md §Steps); keys only, the component translates. */
export interface CardView {
  /** `{i} / 4`. */
  step: 1 | 2 | 3 | 4;
  /** Collapsed to one line while a run plays. */
  line?: Key;
  title?: Text;
  body?: Key;
  /** Step 1: "N of 176,000 neurons take part". */
  count?: boolean;
  /** Step 4: the key list (desktop) or the "tools are on a computer" line (phone). */
  sheet?: 'keys' | 'phone';
  ghost?: Key;
  pill?: Key;
}

export const TOUR_STEPS = 4;

/** Takeoff in `at` ms, one decimal (29.7). */
const takeoff = (at: number): Text => ({ key: 'tour.scare.title', vars: { ms: Math.round(at * 10) / 10 } });

/** The card for a tour state; `null` = no card (no tour, or the narration). */
export function cardView(
  s: TourState | null,
  o: { outcome: LastBeat | null; preparing: boolean; phone: boolean },
): CardView | null {
  if (!s || s.step === 0) return null;
  const { outcome, preparing, phone } = o;
  const tookOff = !!outcome && !outcome.missed;
  switch (s.step) {
    case 1:
      return {
        step: 1,
        title: { key: 'tour.see.title' },
        body: 'tour.see.body',
        count: true,
        pill: 'tour.see.cta',
      };
    case 2:
      if (s.phase !== 'done')
        return { step: 2, line: phone ? 'tour.scare.runningPhone' : 'tour.scare.running' };
      return {
        step: 2,
        // the baked run always takes off; no outcome = it never got that far
        title: tookOff ? takeoff(outcome.at) : { key: 'tour.broken.title' },
        body: tookOff ? 'tour.scare.body' : undefined,
        ghost: 'tour.again',
        pill: 'tour.scare.cta',
      };
    case 3:
      if (s.phase === 'idle')
        return {
          step: 3,
          title: { key: 'tour.break.title' },
          body: 'tour.break.body',
          pill: 'tour.break.cta',
        };
      if (s.phase === 'running')
        return { step: 3, line: preparing ? 'tour.preparing' : 'tour.break.running' };
      return {
        step: 3,
        // say what happened, even if the live fly jumped after all
        title: tookOff ? takeoff(outcome.at) : { key: 'tour.broken.title' },
        body: tookOff ? undefined : 'tour.broken.body',
        ghost: 'tour.again',
        pill: 'tour.broken.cta',
      };
    case 4:
      return phone
        ? { step: 4, title: { key: 'tour.end.title' }, sheet: 'phone', pill: 'tour.end.phoneCta' }
        : { step: 4, title: { key: 'tour.end.title' }, sheet: 'keys', pill: 'tour.end.cta' };
  }
}
