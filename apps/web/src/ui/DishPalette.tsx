import { type ItemKind, PUPPET, type PuppetKey } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from 'react';
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
  'pointer-events-auto size-8 justify-center gap-3 rounded-full text-mist md:h-8 md:w-44 md:justify-start md:rounded-md md:px-2 md:[@media(max-height:860px)]:h-7';

/** Things to drag into the dish (a tap drops one ahead of the fly). */
export function ItemButtons({ input }: { input: PaletteInput }) {
  return ITEM_KEYS.map((k, i) => (
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
  ));
}

/** The two tools; the picked one is lit. */
export const HandButtons = observer(function HandButtons() {
  return HAND_KEYS.map((h, i) => (
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
  ));
});

/**
 * The Terrarium palette (TERRARIUM-SHAPE §Layout): things to drag into the dish and the two hands,
 * the puppet keys below. Desktop only: the left column, no panel (the phone has `DishSheet`).
 */
export const DishPalette = observer(function DishPalette({ input }: { input: PaletteInput }) {
  const heading = 'px-2 pb-1 font-mono text-caption tracking-widest text-ash uppercase';
  const hint = dish.hand ? t('dish.hand.put') : dish.empty ? t('dish.hint.empty') : null;
  return (
    <div
      data-band-left
      className="pointer-events-none absolute top-10 bottom-28 left-8 z-10 hidden flex-col items-start justify-center gap-6 md:flex [@media(max-height:860px)]:gap-3"
    >
      <div className="flex flex-col gap-6 [@media(max-height:860px)]:gap-4">
        <section aria-label={t('dish.items')} className="flex flex-col gap-0.5">
          <h2 className={heading}>{t('dish.items')}</h2>
          <ItemButtons input={input} />
        </section>
        <section aria-label={t('dish.hands')} className="flex flex-col gap-0.5">
          <h2 className={heading}>{t('dish.hands')}</h2>
          <HandButtons />
        </section>
        <section aria-label={t('puppet.title')} className="flex flex-col">
          <h2 className={heading}>
            {t('puppet.title')} <span className="tracking-normal normal-case">· {t('puppet.hint')}</span>
          </h2>
          <Puppet />
        </section>
      </div>
      <div className="flex h-16 flex-col items-start gap-1">
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
