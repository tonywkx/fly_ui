import { type ItemKind, PUPPET, type PuppetKey } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { HAND_KEYS, ITEM_KEYS } from '@/scene/dish/input';
import type { Pull } from '@/scene/dish/loop';
import { dish, type Hand } from '@/state/dish';
import { PULL_GLYPH, puppetHops } from './puppet';

/** What the palette needs from the dish input. */
export interface PaletteInput {
  dragNew(kind: ItemKind, e: PointerEvent): void;
  place(kind: ItemKind): boolean;
  reset(): void;
}

const svg = (body: ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0" fill="none" stroke="currentColor">
    {body}
  </svg>
);

/** 24 px glyphs in each thing's own colour (faceted, like the items in the dish). */
const GLYPH: Record<ItemKind | Hand, { icon: ReactNode; tone: string }> = {
  sugar: {
    tone: 'text-saffron',
    icon: svg(
      <g fill="currentColor" stroke="none">
        <path d="M11 4l3.5 6-3.5 6-3.5-6z" />
        <path d="M17 10l2.5 4.5L17 19l-2.5-4.5z" opacity=".8" />
        <path d="M6 13l2 3.5L6 20l-2-3.5z" opacity=".7" />
      </g>,
    ),
  },
  bitter: {
    tone: 'text-nt-glutamate',
    icon: svg(
      <>
        <ellipse cx="12" cy="13" rx="8" ry="4.5" />
        <ellipse cx="12" cy="13" rx="2.5" ry="1.5" fill="currentColor" stroke="none" />
      </>,
    ),
  },
  odor: {
    tone: 'text-mist',
    icon: svg(
      <g strokeLinecap="round">
        <path d="M4 8c2.5-2 5.5 2 8 0s5.5 2 8 0" />
        <path d="M4 13c2.5-2 5.5 2 8 0s5.5 2 8 0" opacity=".75" />
        <path d="M4 18c2.5-2 5.5 2 8 0s5.5 2 8 0" opacity=".5" />
      </g>,
    ),
  },
  female: {
    tone: 'text-bone',
    icon: svg(
      <>
        <ellipse cx="12" cy="14" rx="2.6" ry="5.5" />
        <circle cx="12" cy="6.5" r="1.8" />
        <path d="M10 11 4.5 16.5M14 11l5.5 5.5" opacity=".7" />
      </>,
    ),
  },
  shadow: {
    tone: 'text-bone',
    icon: svg(<circle cx="12" cy="12" r="8" className="fill-void" strokeOpacity=".8" />),
  },
  swatter: {
    tone: 'text-bone',
    icon: svg(
      <>
        <rect x="11" y="3" width="10" height="10" rx="2" transform="rotate(45 16 8)" />
        <path d="M12.5 12.5 4 21" strokeLinecap="round" />
      </>,
    ),
  },
};

function Row({ id, keyHint, children }: { id: ItemKind | Hand; keyHint: number; children: ReactNode }) {
  return (
    <>
      <span className={GLYPH[id].tone}>{GLYPH[id].icon}</span>
      <span className="hidden flex-1 text-left text-label md:inline">{children}</span>
      <kbd className="hidden font-mono text-caption text-ash md:inline">{keyHint}</kbd>
    </>
  );
}

/** Held while the pointer is down on it (as an arrow key is held). */
function holdProps(keys: readonly Pull[]) {
  const set = (on: boolean) => {
    for (const k of keys) dish.pull(k, on);
  };
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      set(true);
    },
    onPointerUp: () => set(false),
    onPointerCancel: () => set(false),
    onLostPointerCapture: () => set(false),
  };
}

const ROW =
  'pointer-events-auto size-8 justify-center gap-3 rounded-full text-mist md:h-8 md:w-44 md:justify-start md:rounded-md md:px-2';

/**
 * The Terrarium palette (TERRARIUM-SHAPE §Layout): things to drag into the dish (a tap drops one
 * ahead of the fly) and the two hands. Desktop: the left column, no panel. Phone: one row above
 * the credit line.
 */
export const DishPalette = observer(function DishPalette({ input }: { input: PaletteInput }) {
  const heading = 'hidden px-2 pb-1 font-mono text-caption tracking-widest text-ash uppercase md:block';
  const hint = dish.hand ? t('dish.hand.put') : dish.empty ? t('dish.hint.empty') : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex flex-col items-center gap-2 md:inset-x-auto md:top-1/2 md:bottom-auto md:left-8 md:-translate-y-1/2 md:items-start md:gap-6">
      <div className="flex items-center gap-2 md:hidden">
        <p className="text-caption text-ash">{dish.hand ? t('dish.hand.put') : t('dish.hint.tap')}</p>
        {!dish.empty && (
          <Button
            className="pointer-events-auto h-8 px-2 text-caption text-mist"
            onClick={() => input.reset()}
          >
            {t('dish.reset')}
          </Button>
        )}
      </div>
      <div className="flex gap-3 md:flex-col md:gap-6">
        <section aria-label={t('dish.items')} className="flex gap-1 md:flex-col md:gap-0.5">
          <h2 className={heading}>{t('dish.items')}</h2>
          {ITEM_KEYS.map((k, i) => (
            <Button
              key={k}
              aria-label={t(`dish.item.${k}`)}
              className={cn(ROW, 'touch-none cursor-grab active:cursor-grabbing')}
              onPointerDown={(e) => {
                if (e.button === 0) input.dragNew(k, e.nativeEvent);
              }}
              // keyboard Enter / Space (a pointer press is handled by the drag)
              onClick={(e) => {
                if (e.detail === 0) input.place(k);
              }}
            >
              <Row id={k} keyHint={i + 1}>
                {t(`dish.item.${k}`)}
              </Row>
            </Button>
          ))}
        </section>
        <section aria-label={t('dish.hands')} className="flex gap-1 md:flex-col md:gap-0.5">
          <h2 className={heading}>{t('dish.hands')}</h2>
          {HAND_KEYS.map((h, i) => (
            <Button
              key={h}
              aria-label={t(`dish.hand.${h}`)}
              aria-pressed={dish.hand === h}
              className={cn(
                ROW,
                'aria-pressed:bg-bone/15 aria-pressed:text-bone aria-pressed:ring-1 aria-pressed:ring-bone/40',
              )}
              onClick={() => dish.toggleHand(h)}
            >
              <Row id={h} keyHint={i + 5}>
                {t(`dish.hand.${h}`)}
              </Row>
            </Button>
          ))}
        </section>
        <Puppet heading={heading} />
      </div>
      <div className="hidden h-16 flex-col items-start gap-1 md:flex">
        {hint && <p className="max-w-44 px-2 text-caption text-ash">{hint}</p>}
        {!dish.empty && (
          <Button
            className="pointer-events-auto h-8 w-44 justify-between px-2 text-caption text-ash"
            onClick={() => input.reset()}
          >
            {t('dish.reset')}
            <kbd className="font-mono">R</kbd>
          </Button>
        )}
      </div>
    </div>
  );
});

const PUPPET_KEYS = Object.keys(PUPPET) as PuppetKey[];

/** Puppet mode (8.13): the arrows drive command cells while held; ← → steer (scripted). Desktop only. */
const Puppet = observer(function Puppet({ heading }: { heading: string }) {
  const pressed =
    'aria-pressed:bg-bone/15 aria-pressed:text-bone aria-pressed:ring-1 aria-pressed:ring-bone/40';
  const glyph = 'w-6 shrink-0 text-center font-mono text-label';
  const steering = dish.pulls.has('left') || dish.pulls.has('right');
  return (
    <section aria-label={t('puppet.title')} className="hidden flex-col gap-0.5 md:flex">
      <h2 className={heading}>{t('puppet.title')}</h2>
      {PUPPET_KEYS.map((k) => {
        const type = puppetHops(k)[0]?.type ?? '';
        return (
          <Button
            key={k}
            aria-label={t('puppet.hold', { key: PULL_GLYPH[k], act: t(`puppet.${k}`), type })}
            aria-pressed={dish.pulls.has(k)}
            className={cn(ROW, 'touch-none select-none', pressed)}
            {...holdProps([k])}
          >
            <kbd className={glyph}>{PULL_GLYPH[k]}</kbd>
            <span className="flex-1 text-left text-label">{t(`puppet.${k}`)}</span>
            <span className="font-mono text-caption text-ash">{type}</span>
          </Button>
        );
      })}
      <div
        title={t('puppet.steer.note')}
        className={cn(ROW, 'flex items-center text-mist', steering && 'text-bone')}
      >
        {(['left', 'right'] as const).map((k) => (
          <Button
            key={k}
            aria-label={`${PULL_GLYPH[k]} ${t('puppet.steer')}`}
            aria-pressed={dish.pulls.has(k)}
            className={cn(
              'pointer-events-auto -mx-1.5 size-6 touch-none rounded-sm font-mono text-label',
              pressed,
            )}
            {...holdProps([k])}
          >
            {PULL_GLYPH[k]}
          </Button>
        ))}
        <span className="flex-1 pl-1.5 text-left text-label">{t('puppet.steer')}</span>
        <span className="font-mono text-caption text-ash">{t('puppet.scripted')}</span>
      </div>
    </section>
  );
});
