import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { data } from '@/data/store';
import { type Key, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';

/** First move to try once the intro lands, per scenario (none until that scenario has a tool). */
const HINTS: Record<string, Key> = { escape: 'hint.escape' };

/** The hint is on screen (only scenarios with a hint ever show one). */
export const hintShown = () => app.hintVisible && !!data.scenario && !!HINTS[data.scenario];

/** Shown once after the intro; the first press anywhere dismisses it. */
export const IntroHint = observer(function IntroHint() {
  const text = data.scenario ? HINTS[data.scenario] : undefined;
  const shown = app.hintVisible && !!text;

  useEffect(() => {
    if (!shown) return;
    const dismiss = () => app.dismissHint();
    window.addEventListener('pointerdown', dismiss, { once: true });
    return () => window.removeEventListener('pointerdown', dismiss);
  }, [shown]);

  if (!text) return null;
  return (
    <p
      aria-hidden={!shown}
      className={cn(
        // bottom band, clear of the CNS; bone for contrast over the brightest glow
        'pointer-events-none absolute inset-x-0 bottom-4 text-center text-body font-light text-bone md:bottom-8',
        'transition-[opacity,translate] duration-200 ease-out motion-reduce:translate-y-0',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
      )}
    >
      {t(text)}
    </p>
  );
});
