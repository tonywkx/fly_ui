import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { data } from '@/data/store';
import { t } from '@/i18n';
import { playback } from '@/state/playback';
import { LangSwitch } from './LangSwitch';
import { TourRestart } from './tour/TourChrome';
import { scenarioHref, scenarioTitle } from './viewer';

/**
 * Phones: the viewer without tools (PRODUCT.md) — play/pause and the scenarios, nothing else.
 * Switching reloads with `?scenario=` (each scenario is its own lazy chunk set).
 */
export const ViewerBar = observer(function ViewerBar() {
  const scenarios = data.manifest?.scenarios ?? [];
  const { paused } = playback;
  if (scenarios.length === 0) return null;
  return (
    <nav aria-label={t('scenarios.label')} className="pointer-events-auto flex items-center gap-1 md:hidden">
      <Button
        aria-label={t(paused ? 'timeline.play' : 'timeline.pause')}
        onClick={() => playback.toggle()}
        // a hairline ring: ghost (one primary per view) but still reads as a control on black
        className="size-8 shrink-0 rounded-full border border-ash/40 p-0 text-bone hover:border-bone/70 hover:text-bone"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 fill-current">
          {paused ? <path d="M4 2.5v11l9.5-5.5z" /> : <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />}
        </svg>
      </Button>
      <ul className="flex min-w-0 list-none items-center overflow-x-auto [scrollbar-width:none]">
        {scenarios.map((s) => {
          const current = s.id === data.scenario;
          return (
            <li key={s.id} className="shrink-0">
              <Button
                variant="ghost"
                asChild
                // current: colour + underline, never hue alone
                className="h-8 px-2.5 text-body font-light text-ash decoration-bone/60 underline-offset-8 aria-[current=page]:text-bone aria-[current=page]:underline"
              >
                <a
                  href={scenarioHref(window.location.search, s.id)}
                  aria-current={current ? 'page' : undefined}
                >
                  {scenarioTitle(s.id, 'short', s.title)}
                </a>
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="ml-auto flex shrink-0 items-center">
        <TourRestart />
        <LangSwitch compact />
      </div>
    </nav>
  );
});
