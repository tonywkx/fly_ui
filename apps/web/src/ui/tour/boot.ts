import { when } from 'mobx';
import { data } from '@/data/store';
import { app } from '@/state/app';
import { panicRows, startStep, type TourStore, tour } from '@/state/tour';

declare global {
  interface Window {
    /** Dev only: drive the tour from the console / Playwright. */
    __tour?: TourStore;
  }
}

/** Opens the tour on a first visit (or `?tour=`), hands it the DNp01 rows, ends the narration with the intro. */
export function bootTour() {
  if (import.meta.env.DEV) window.__tour = tour;
  when(
    () => data.scenario !== null,
    () => {
      const scenario = data.scenario as string;
      const step = startStep({ params: app.params, seen: tour.seen, scenario });
      if (step === null) return;
      tour.start(step);
      const meta = () => data.get(`${scenario}-meta`, 'meta');
      when(
        () => !!meta(),
        () => tour.setPanic(panicRows(meta() as NonNullable<ReturnType<typeof meta>>)),
      );
      when(
        () => app.introPhase === 'done',
        () => {
          if (tour.state?.step === 0) tour.next();
        },
      );
    },
  );
}
