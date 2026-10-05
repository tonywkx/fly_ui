import { reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { data } from '@/data/store';
import { type Key, num, plural, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { anatomyView } from '@/scene/anatomy';
import { experiment } from '@/state/experiment';
import { tour } from '@/state/tour';
import { scenarioHref } from '../viewer';
import { type CardView, cardView, TOUR_STEPS } from './cardView';

/** Px kept between the anatomy labels and the card. */
const LABEL_GAP = 8;

/** Tool keys of the cheat sheet: "V · Select — …" → key mono, text beside it. */
const SHEET: Key[] = ['tour.end.select', 'tour.end.stim', 'tour.end.silence', 'tour.end.probe'];
const MORE: { id: string; key: Key }[] = [
  { id: 'sugar', key: 'tour.end.sugar' },
  { id: 'song', key: 'tour.end.song' },
];

/**
 * The tour's step card (docs/TOUR.md): counter, title, body, one violet pill, ghost "Again".
 * Desktop: bottom-centre in the toolbar's slot; `phone`: in place of the ViewerBar, Skip inside.
 * Content crossfades on every step / phase change; the card itself stays put.
 */
export const TourCard = observer(function TourCard({
  phone = false,
  className,
}: {
  phone?: boolean;
  className?: string;
}) {
  const s = tour.state;
  const v = cardView(s, { outcome: tour.outcome, preparing: tour.preparing, phone });

  // Esc: skips the tour, or closes the cheat sheet
  const shown = !!v;
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (tour.state?.step === 4) tour.next();
      else tour.skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown]);

  // cheat sheet: the first tool pick closes it (desktop only: phones have no tools)
  const sheet = v?.sheet === 'keys';
  useEffect(() => {
    if (!sheet) return;
    return reaction(
      () => experiment.tool,
      () => tour.next(),
    );
  }, [sheet]);

  // the content re-keys on every step / phase: a pill that had focus unmounts, hand it to the new one
  const pill = useRef<HTMLButtonElement>(null);
  const swap = s && `${s.step}-${s.phase}-${tour.preparing}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: refocus on every content swap
  useEffect(() => {
    const lost = !document.activeElement || document.activeElement === document.body;
    if (lost) pill.current?.focus({ preventScroll: true });
  }, [swap]);

  // anatomy labels keep clear of the card (layout read on resize only, never per frame)
  const box = useRef<HTMLElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-attach when the card mounts / unmounts
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      // the other breakpoint's card is display: none
      if (el.offsetParent !== null) anatomyView.bottom = el.getBoundingClientRect().top - LABEL_GAP;
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      anatomyView.bottom = Number.POSITIVE_INFINITY;
    };
  }, [shown]);

  if (!s || !v) return null;
  return (
    <section
      ref={box}
      aria-label={t('tour.step', { i: v.step, n: TOUR_STEPS })}
      className={cn(
        // hairline: over the scene the panel's edge must read as a card, not a clip
        'pointer-events-auto relative z-20 w-full max-w-[34rem] rounded-xl border border-border bg-card p-3 backdrop-blur-md',
        'transition-opacity duration-200 ease-out starting:opacity-0',
        className,
      )}
    >
      {/* one persistent live region: a region mounted already filled is not announced */}
      <p role="status" className="sr-only">
        {v.line ? t(v.line) : v.title ? t(v.title.key, v.title.vars) : ''}
      </p>
      {/* key: every step / phase swaps the content with a crossfade */}
      <div
        key={swap}
        className="flex flex-col gap-2 transition-opacity duration-200 ease-out starting:opacity-0"
      >
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-caption text-ash tabular-nums">
            {t('tour.step', { i: v.step, n: TOUR_STEPS })}
          </span>
          {v.line && (
            <p aria-hidden className="min-w-0 flex-1 text-label text-bone">
              {t(v.line)}
            </p>
          )}
          {phone && v.step < 4 && (
            <Button onClick={() => tour.skip()} className="-my-3 ml-auto h-11 text-caption">
              {t('tour.skip')}
            </Button>
          )}
        </div>
        {v.title && (
          <h2 className="text-body leading-tight font-normal tracking-[-0.02em] text-bone">
            {t(v.title.key, v.title.vars)}
          </h2>
        )}
        {v.body && <p className="text-label leading-snug font-light text-mist text-pretty">{t(v.body)}</p>}
        {v.count && <Count />}
        {v.sheet && <Sheet view={v} />}
        {(v.pill || v.ghost) && (
          <div className="mt-1 flex items-center justify-end gap-3">
            {v.ghost && <Button onClick={() => tour.again()}>{t(v.ghost)}</Button>}
            {v.pill && (
              <Button ref={pill} variant="primary" onClick={() => tour.next()}>
                {t(v.pill)}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
});

/** "N of 176,000 neurons take part in this run" (mono number). */
const Count = observer(function Count() {
  const meta = data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  if (!meta) return null;
  const n = num(meta.n);
  const [before, after] = plural('tour.see.count', meta.n).split(n);
  return (
    <p className="text-label font-light text-mist">
      {before}
      <span className="font-mono text-bone tabular-nums">{n}</span>
      {after}
    </p>
  );
});

function Sheet({ view }: { view: CardView }) {
  return (
    <>
      {view.sheet === 'keys' ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-label font-light">
          {SHEET.map((key) => {
            const [k, text = ''] = t(key).split(' · ');
            return (
              <div key={key} className="contents">
                <dt className="font-mono text-bone">{k}</dt>
                <dd className="text-mist">{text}</dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-label leading-snug font-light text-mist text-pretty">{t('tour.end.phone')}</p>
      )}
      {view.sheet === 'keys' && <p className="font-mono text-caption text-ash">{t('tour.end.play')}</p>}
      <p className="flex items-center gap-1 text-label font-light text-ash">
        {t('tour.end.more')}
        {MORE.map(({ id, key }) => (
          <Button key={id} asChild className="text-label text-bone">
            <a href={scenarioHref(window.location.search, id)}>{t(key)}</a>
          </Button>
        ))}
      </p>
    </>
  );
}
