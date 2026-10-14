import { when } from 'mobx';
import { observer } from 'mobx-react-lite';
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { num, t } from '@/i18n';
import { useMedia } from '@/lib/useWide';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import { dish } from '@/state/dish';
import { loadLine, loadPct, type WelcomeMode, welcome } from '@/state/welcome';
import { Credit } from './Credit';
import { LangSwitch } from './LangSwitch';

// Lives in the entry chunk (main.tsx), beside the lazy App: nothing App-side may be imported here.

type Shown = Exclude<WelcomeMode, 'off'>;

/** WELCOME-SHAPE §Motion: full = column 180 ms, then the scrim 300 ms; short = one 300 ms fade. */
const EXIT: Record<Shown, number> = { full: 480, short: 300 };
/** Short splash: shown at least this long once the brain is up, never longer than the cap. */
const SHORT_MIN = 1000;
const SHORT_CAP = 4000;

/** «?» that reopened the full welcome; Esc hands focus back to it. */
let returnTo: HTMLElement | null = null;

/** Held alone (or as shortcuts) they don't skip the short splash. */
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

/** Snaps and reduced motion: no entrance, no exit. */
const instant = () => app.reducedMotion || app.params.snap;

/**
 * The welcome over the dish (`welcome.mode`): the full screen on a first visit / «?», the short
 * splash on a return. The store closes at once (onboarding starts); the screen lingers for its exit.
 */
export const Welcome = observer(function Welcome() {
  const mode = welcome.mode;
  const [shown, setShown] = useState<Shown | null>(mode === 'off' ? null : mode);
  const [out, setOut] = useState(false);
  if (mode !== 'off' && (shown !== mode || out)) {
    setShown(mode);
    setOut(false);
  } else if (mode === 'off' && shown && !out) setOut(true);

  useEffect(() => {
    if (!out || !shown) return;
    const id = setTimeout(
      () => {
        setShown(null);
        setOut(false);
        // Esc after «?»: back to «?»; otherwise the card (its unseen heading, the tabs come next)
        if (shown === 'full')
          (returnTo ?? document.querySelector<HTMLElement>('[data-card] [tabindex="-1"]'))?.focus();
        returnTo = null;
      },
      instant() ? 0 : EXIT[shown],
    );
    return () => clearTimeout(id);
  }, [out, shown]);

  if (!shown) return null;
  return shown === 'full' ? <Full out={out} /> : <Short out={out} />;
});

/** Column items rise in one after another (40 ms apart). */
function rise(i: number): { className: string; style?: CSSProperties } {
  if (instant()) return { className: '' };
  return {
    className:
      'motion-safe:transition-[opacity,translate] motion-safe:duration-240 motion-safe:ease-out motion-safe:starting:translate-y-[8px] motion-safe:starting:opacity-0',
    style: { transitionDelay: `${i * 40}ms` },
  };
}

function Full({ out }: { out: boolean }) {
  // a landscape phone or a short window takes the phone's bottom column: the left one can't fit the CTA
  const wide = useMedia('(width >= 48rem) and (height >= 35rem)');
  const title = useId();
  const start = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener =
      welcome.again && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    start.current?.focus({ preventScroll: true });
    // modal: keys never reach the app's own shortcuts underneath
    const onKey = (e: KeyboardEvent) => {
      const inside = e.target instanceof Node && dialog.current?.contains(e.target);
      if (e.key === 'Escape') {
        e.preventDefault();
        returnTo = opener;
        welcome.close();
      } else if (
        e.key === 'Enter' &&
        !(inside && e.target instanceof HTMLElement && e.target.closest('a, button'))
      ) {
        e.preventDefault();
        welcome.start();
      }
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const steps = (['welcome.step.1', 'welcome.step.2', 'welcome.step.3'] as const).map((k, i) => (
    <li key={k} className="flex gap-2">
      <span className="font-mono text-ash">{i + 1}</span>
      <span>{t(k)}</span>
    </li>
  ));
  // in order: each rises 40 ms after the one before
  const copy: Record<string, ReactNode> = {
    title: (
      <h2
        id={title}
        className="text-[length:clamp(var(--text-body)*1.75,8vw,var(--text-heading-sm))] leading-[1.05] font-normal tracking-[-0.04em] md:text-heading-sm"
      >
        {t('welcome.title')}
      </h2>
    ),
    lede: <p className="text-body leading-snug">{t('welcome.lede')}</p>,
    what: (
      <p className="text-label text-mist [@media(max-height:719px)]:text-caption">
        {t('welcome.what', { n: num(176000) })}
      </p>
    ),
    steps: <ol className="flex flex-col gap-1 text-label">{steps}</ol>,
  };
  const cta = (
    <div className="flex flex-col items-stretch gap-2 md:items-start">
      <Button ref={start} variant="primary" className="max-md:h-8" onClick={() => welcome.start()}>
        {t('welcome.start')}
      </Button>
      <LoadLine className="md:w-50" />
    </div>
  );
  const items = Object.entries({ ...copy, cta }).map(([key, node], i) => {
    const r = rise(i);
    return (
      <div key={key} className={r.className} style={r.style}>
        {node}
      </div>
    );
  });

  // the column fades first (180 ms), the scrim follows (300 ms)
  const fade = 'transition-opacity ease-out motion-reduce:transition-none';
  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title}
      className={cn('fixed inset-0 z-20', out && 'pointer-events-none')}
    >
      <div
        aria-hidden="true"
        className={cn('absolute inset-0', fade, 'duration-300', out && 'opacity-0 delay-180')}
        // no backdrop blur: it would pop as the scrim fades, and it costs frames over the live canvas
        style={{
          background: wide
            ? 'linear-gradient(to right, color-mix(in srgb, var(--color-void) 85%, transparent) calc(var(--spacing) * 85), transparent max(45%, calc(var(--spacing) * 125)))'
            : 'linear-gradient(to top, color-mix(in srgb, var(--color-void) 90%, transparent) 55%, transparent 70%)',
        }}
      ></div>
      <div className={cn('absolute inset-0', fade, 'duration-180', out && 'opacity-0')}>
        {wide ? (
          <>
            <div className="absolute inset-y-28 left-7 flex w-75 flex-col justify-center-safe gap-4 overflow-y-auto px-1 py-8 [@media(max-height:799px)]:top-8">
              {items}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-8">
              <div>
                <p className="text-heading-lg leading-none font-normal tracking-[-0.04em]">fly_ui</p>
                <div className="pointer-events-auto -mx-1 mt-1 flex items-center gap-1">
                  <LangSwitch />
                </div>
              </div>
              <Credit />
            </div>
          </>
        ) : (
          <div className="absolute inset-x-0 bottom-0 flex max-h-full flex-col gap-3 px-4 pt-16 pb-[max(var(--spacing)*4,env(safe-area-inset-bottom))]">
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">{items.slice(0, -1)}</div>
            {items.at(-1)}
            <div className="-mx-1 flex flex-wrap items-center justify-between gap-x-2">
              <LangSwitch />
              <Credit />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Short({ out }: { out: boolean }) {
  useEffect(() => {
    const t0 = performance.now();
    const leave = () => welcome.close();
    const cap = setTimeout(leave, SHORT_CAP);
    let min: ReturnType<typeof setTimeout> | undefined;
    const ready = when(
      () => dish.cells !== null,
      () => {
        min = setTimeout(leave, Math.max(0, SHORT_MIN - (performance.now() - t0)));
      },
    );
    // any key skips; it is spent on the splash, not the dish
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || MODIFIERS.has(e.key)) return;
      e.stopPropagation();
      leave();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(cap);
      clearTimeout(min);
      ready();
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  return (
    // a click skips and stays here: the overlay takes it, not the dish under it
    // biome-ignore lint/a11y/useKeyWithClickEvents: keys skip via the window listener above
    // biome-ignore lint/a11y/noStaticElementInteractions: a pointer-only skip; not a control
    <div
      onClick={() => welcome.close()}
      className={cn(
        'fixed inset-0 z-20 flex flex-col items-center justify-center gap-3 px-4',
        'bg-void/60 transition-opacity duration-300 ease-out motion-reduce:transition-none',
        out && 'pointer-events-none opacity-0',
      )}
    >
      <p className="text-center text-[length:clamp(var(--text-body)*1.75,8vw,var(--text-heading-sm))] leading-none tracking-[-0.04em] md:text-heading-sm">
        {t('welcome.title')}
      </p>
      <LoadLine className="w-50 items-center" />
    </div>
  );
}

/** «загружаем мозг · 42 %» over a hairline (WELCOME-SHAPE §Progress & states). */
const LoadLine = observer(function LoadLine({ className }: { className?: string }) {
  const pct = loadPct(dish.loading, dish.cells !== null);
  const line = loadLine(pct, dish.failed);
  // reopened with the brain already up: no hairline to empty out
  const [loadingAtMount] = useState(pct !== 'ready');
  const bar = line.key === 'welcome.loading' || (line.key === 'welcome.ready' && loadingAtMount);
  const fill = pct === 'ready' ? 1 : (pct ?? 0) / 100;
  // the hairline carries information: it moves under reduced motion too, only snaps freeze it
  const { snap } = app.params;
  const swap = instant()
    ? ''
    : 'motion-safe:transition-opacity motion-safe:duration-150 motion-safe:starting:opacity-0';
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* one live node: ready / failed are announced, the ticking % is not (the progressbar has it) */}
      <p role="status" className="sr-only">
        {line.key === 'welcome.ready' || line.key === 'welcome.failed' ? t(line.key) : ''}
      </p>
      <p
        key={line.key}
        className={cn('flex items-center gap-1 font-mono text-caption text-ash tabular-nums', swap)}
      >
        <span aria-hidden="true">
          {line.key === 'welcome.loading' ? t(line.key, { pct: line.pct }) : t(line.key)}
        </span>
        {line.key === 'welcome.failed' && (
          <Button className="h-auto text-caption" onClick={() => location.reload()}>
            {t('welcome.retry')}
          </Button>
        )}
      </p>
      {bar && (
        <div
          role="progressbar"
          aria-label={t('welcome.loadingAny')}
          aria-valuenow={Math.round(fill * 100)}
          className={cn(
            'h-px w-full overflow-hidden bg-bone/15',
            !snap && 'transition-opacity duration-300 ease-out motion-reduce:transition-none',
            pct === 'ready' && 'opacity-0',
          )}
        >
          <div
            className={cn(
              'h-full origin-left bg-bone',
              !snap && 'transition-transform duration-150 ease-linear',
            )}
            style={{ transform: `scaleX(${fill})` }}
          />
        </div>
      )}
    </div>
  );
});
