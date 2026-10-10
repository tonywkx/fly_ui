import { type ItemKind, PUPPET, type PuppetKey } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { HAND_KEYS, ITEM_KEYS, SLOT_OF } from '@/scene/dish/input';
import type { Pull } from '@/scene/dish/loop';
import { dish, type Hand } from '@/state/dish';
import { trial } from '@/state/trial';
import { PULL_GLYPH, puppetHops } from './puppet';

/** What the palette needs from the dish input. */
export interface PaletteInput {
  dragNew(kind: ItemKind, e: PointerEvent, tap?: () => void): void;
  dragHand(h: Hand, e: PointerEvent, tap: () => void): void;
  place(kind: ItemKind): boolean;
  reset(): void;
}

const svg = (body: ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0" fill="none" stroke="currentColor">
    {body}
  </svg>
);

/** 24 px glyphs in each thing's own colour (faceted, like the items in the dish). */
export const GLYPH: Record<ItemKind | Hand, { icon: ReactNode; tone: string }> = {
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

/** Glyph, name, hotkey; on desktop a second line with what the fly does, a dot when it is in the card. */
const Row = observer(function Row({
  id,
  keyHint,
  children,
}: {
  id: ItemKind | Hand;
  keyHint: number;
  children: ReactNode;
}) {
  const inExp = trial.stim !== null && SLOT_OF[id] === trial.stim;
  const inHand = dish.hand === id;
  return (
    <>
      <span className={GLYPH[id].tone}>{GLYPH[id].icon}</span>
      <span className="hidden min-w-0 flex-1 flex-col text-left md:flex">
        <span className="flex items-center gap-1.5 text-label">
          {children}
          {inExp && (
            <span title={t('pal.inExp')} className="size-1.5 rounded-full bg-saffron">
              <span className="sr-only">{t('pal.inExp')}</span>
            </span>
          )}
        </span>
        <span className={cn('text-caption', inHand ? 'text-bone' : 'text-ash')}>
          {inHand ? t('pal.inHand') : t(`pal.does.${id}`)}
        </span>
      </span>
      <kbd className="hidden self-start pt-1 font-mono text-caption text-ash md:inline">{keyHint}</kbd>
    </>
  );
});

/** A key cap held by the pointer, or by Space / Enter while focused, as its arrow key is held. */
function holdProps(k: Pull) {
  const set = (on: boolean) => dish.pull(k, on);
  const own = (e: ReactKeyboardEvent) => e.key === ' ' || e.key === 'Enter';
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      set(true);
    },
    onLostPointerCapture: () => set(false),
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
    // not the dish's Space (pause)
    onKeyDown: (e: ReactKeyboardEvent) => {
      if (!own(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat) set(true);
    },
    onKeyUp: (e: ReactKeyboardEvent) => {
      if (own(e)) set(false);
    },
    onBlur: () => set(false),
  };
}

const ROW =
  'pointer-events-auto size-8 justify-center gap-3 rounded-full text-mist md:h-auto md:w-44 md:items-start md:justify-start md:rounded-md md:px-2 md:py-1';

/**
 * Things to drag into the dish. A tap (or Enter) puts the stimulus in the card (`slot`, desktop);
 * without the card (phone, banana) it drops one ahead of the fly.
 */
export function ItemButtons({ input, slot = false }: { input: PaletteInput; slot?: boolean }) {
  return ITEM_KEYS.map((k, i) => {
    const s = slot ? SLOT_OF[k] : undefined;
    const tap = s ? () => trial.setStim(s) : () => void input.place(k);
    return (
      <Button
        key={k}
        aria-label={t(`dish.item.${k}`)}
        className={cn(ROW, 'touch-none cursor-grab active:cursor-grabbing')}
        onPointerDown={(e) => {
          if (e.button === 0) input.dragNew(k, e.nativeEvent, tap);
        }}
        // keyboard Enter / Space (a pointer press is handled by the drag)
        onClick={(e) => {
          if (e.detail === 0) tap();
        }}
      >
        <Row id={k} keyHint={i + 1}>
          {t(`dish.item.${k}`)}
        </Row>
      </Button>
    );
  });
}

/**
 * The two tools. With the card (`slot`): a tap puts it in the experiment, a drag out takes it in
 * hand; without (phone): a tap picks it up. The one in hand is lit.
 */
export const HandButtons = observer(function HandButtons({
  input,
  slot = false,
}: {
  input: PaletteInput;
  slot?: boolean;
}) {
  return HAND_KEYS.map((h, i) => (
    <Button
      key={h}
      aria-label={t(`dish.hand.${h}`)}
      aria-pressed={dish.hand === h}
      className={cn(
        ROW,
        'aria-pressed:bg-bone/15 aria-pressed:text-bone aria-pressed:ring-1 aria-pressed:ring-bone/40',
        slot && 'touch-none',
      )}
      onPointerDown={(e) => {
        if (slot && e.button === 0) input.dragHand(h, e.nativeEvent, () => trial.setStim(h));
      }}
      onClick={(e) => {
        if (!slot) dish.toggleHand(h);
        else if (e.detail === 0) trial.setStim(h);
      }}
    >
      <Row id={h} keyHint={i + 5}>
        {t(`dish.hand.${h}`)}
      </Row>
    </Button>
  ));
});

/**
 * The Terrarium palette (EXPERIMENT-SHAPE §Layout): stimuli to put in the experiment or drag into
 * the dish, the puppet keys under «ещё». Desktop only: the left column, no panel (phone: `DishSheet`).
 * Dimmed and inert while an experiment runs.
 */
export const DishPalette = observer(function DishPalette({ input }: { input: PaletteInput }) {
  const heading = 'px-2 pb-1 font-mono text-caption tracking-widest text-ash uppercase';
  const [more, setMore] = useState(false);
  const running = trial.phase === 'running';
  return (
    <div
      data-band-left
      inert={running}
      className={cn(
        'pointer-events-none absolute top-24 bottom-28 left-8 z-10 hidden flex-col items-start gap-6 transition-opacity duration-200 ease-out motion-reduce:transition-none md:flex [@media(max-height:860px)]:gap-3',
        running && 'opacity-40',
      )}
    >
      <div className="flex flex-col gap-6 [@media(max-height:860px)]:gap-3">
        <section aria-label={t('dish.items')} className="flex flex-col gap-0.5">
          <h2 className={heading}>{t('dish.items')}</h2>
          <ItemButtons input={input} slot />
        </section>
        <section aria-label={t('dish.hands')} className="flex flex-col gap-0.5">
          <h2 className={heading}>{t('dish.hands')}</h2>
          <HandButtons input={input} slot />
        </section>
        <section aria-label={t('puppet.title')} className="flex flex-col gap-1">
          <Button
            aria-expanded={more}
            className="pointer-events-auto h-8 w-44 justify-start gap-1.5 px-2 font-mono text-caption tracking-widest text-ash uppercase"
            onClick={() => setMore(!more)}
          >
            {more ? t('puppet.title') : t('pal.more')}
            <span
              aria-hidden="true"
              className={cn(
                'transition-transform duration-200 ease-out motion-reduce:transition-none',
                more && 'rotate-180',
              )}
            >
              ▾
            </span>
          </Button>
          {more && (
            <>
              <p className="px-2 text-caption text-ash">{t('puppet.hint')}</p>
              <Puppet />
            </>
          )}
        </section>
      </div>
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
  );
});

const PUPPET_KEYS = Object.keys(PUPPET) as PuppetKey[];

/** Inverted-T key caps: ↑ over ← ↓ →. */
const CAPS: { k: Pull; at: string }[] = [
  { k: 'up', at: 'col-start-2' },
  { k: 'left', at: 'col-start-1 row-start-2' },
  { k: 'down', at: 'col-start-2 row-start-2' },
  { k: 'right', at: 'col-start-3 row-start-2' },
];
const SHORTCUT: Record<Pull, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

/**
 * Puppet mode (8.13): arrow key caps held (keyboard, pointer, or Space on a focused cap) drive
 * command cells; ← → steer the scripted walker. `phone`: finger-sized caps.
 */
export const Puppet = observer(function Puppet({ phone = false }: { phone?: boolean }) {
  const note = phone ? 'puppet-note-phone' : 'puppet-note';
  const name = (k: Pull) => (k === 'left' || k === 'right' ? t('puppet.steer') : t(`puppet.${k}`));
  const cell = (k: PuppetKey) => puppetHops(k)[0]?.type ?? '';
  const label = (k: Pull) =>
    k === 'left' || k === 'right'
      ? t('puppet.hold.steer', { key: PULL_GLYPH[k] })
      : t('puppet.hold', { key: PULL_GLYPH[k], act: name(k), type: cell(k) });
  const on = (k: Pull) => dish.pulls.has(k);
  const steering = on('left') || on('right');
  const legend: { keys: string; act: string; term: string; lit: boolean }[] = [
    ...PUPPET_KEYS.map((k) => ({ keys: PULL_GLYPH[k], act: name(k), term: cell(k), lit: on(k) })),
    {
      keys: `${PULL_GLYPH.left}${PULL_GLYPH.right}`,
      act: t('puppet.steer'),
      term: t('puppet.scripted'),
      lit: steering,
    },
  ];
  return (
    <>
      <span id={note} className="sr-only">
        {t('puppet.steer.note')}
      </span>
      <div className={cn('flex items-center', phone ? 'gap-4' : 'w-44 gap-2 px-2')}>
        <div className="pointer-events-auto grid shrink-0 grid-cols-3 gap-0.5">
          {CAPS.map(({ k, at }) => (
            <Button
              key={k}
              aria-label={label(k)}
              aria-pressed={on(k)}
              aria-keyshortcuts={SHORTCUT[k]}
              aria-describedby={k === 'left' || k === 'right' ? note : undefined}
              className={cn(
                at,
                phone ? 'size-8 rounded-md text-label' : 'size-5 rounded-sm text-caption',
                'touch-none font-mono text-mist ring-1 ring-ash/40 select-none hover:text-bone',
                'aria-pressed:bg-bone/15 aria-pressed:text-bone aria-pressed:ring-bone/40',
              )}
              {...holdProps(k)}
            >
              {PULL_GLYPH[k]}
            </Button>
          ))}
        </div>
        <dl
          title={t('puppet.steer.note')}
          className={cn(
            'grid flex-1 grid-cols-[auto_1fr_auto] text-caption',
            phone ? 'gap-x-2 gap-y-1' : 'gap-x-1',
          )}
        >
          {legend.map((l) => (
            <div key={l.keys} className={cn('contents', l.lit ? 'text-bone' : 'text-mist')}>
              <dt className="font-mono text-ash">{l.keys}</dt>
              <dd>{l.act}</dd>
              <dd className="font-mono text-ash">{l.term}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
});
