import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { data } from '@/data/store';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { tour } from '@/state/tour';
import { scenarioHref } from '../viewer';

/** Large FlyCam (steps 2–3, desktop): Skip sits to its left. */
export const bigFlyCam = () => tour.state !== null && (tour.state.step === 2 || tour.state.step === 3);

/**
 * Skip, one tap away: top-right ghost on desktop (steps 0–3); phones only during the narration —
 * after it Skip lives inside the card.
 */
export const TourSkip = observer(function TourSkip() {
  const step = tour.state?.step;
  if (step === undefined || step === 4) return null;
  return (
    <Button
      onClick={() => tour.skip()}
      className={cn(
        'pointer-events-auto absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-20 h-8 text-label md:top-8 md:right-8',
        step > 0 && 'hidden md:inline-flex',
        // beside the big panel it sits over the scene: the labels' void halo keeps it legible
        bigFlyCam() && 'md:right-108 [text-shadow:0_0_6px_var(--color-void),0_0_2px_var(--color-void)]',
      )}
    >
      {t('tour.skip')}
    </Button>
  );
});

/** "?" replays the tour: here on the escape run, else a link to it (the tour is escape only). */
export const TourRestart = observer(function TourRestart({ className }: { className?: string }) {
  if (tour.active || !data.scenario) return null;
  const label = t('tour.restart');
  const cls = cn('pointer-events-auto h-8 w-8 rounded-full font-mono text-caption md:h-6 md:w-6', className);
  if (data.scenario === 'escape')
    return (
      <Button aria-label={label} title={label} onClick={() => tour.start(1)} className={cls}>
        ?
      </Button>
    );
  return (
    <Button asChild className={cls}>
      <a aria-label={label} title={label} href={`${scenarioHref(window.location.search, 'escape')}&tour=1`}>
        ?
      </a>
    </Button>
  );
});
