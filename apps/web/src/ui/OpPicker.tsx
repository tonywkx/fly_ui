import { OPERATIONS } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import { Popover } from 'radix-ui';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type Key, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { OPS, type Op } from '@/scene/dish/verdict';
import { app } from '@/state/app';
import { type Slot, trial } from '@/state/trial';
import { type OpGlyph, opChip, picksText } from './expText';

/** Types inferred, not named in the dataset (LB3 = sugar, pC1 = P1): the hypothesis line. */
const GUESS: ReadonlySet<Op> = new Set(['sugar', 'p1']);
const LABEL = 'font-mono text-caption tracking-widest text-ash uppercase';
/** A phone's tap shows the chosen op's place this long before its mark (SURGEON-SHAPE §Phone). */
const PHONE_PREVIEW_MS = 1500;

/** A list row: an op slot value, or the way to the brain view. */
type Row = Slot | 'pick';
type Glyph = OpGlyph | '⌖';

const GLYPH_TONE: Record<Glyph, string> = {
  '○': 'text-ash',
  '⊘': 'text-ash',
  '●': 'text-saffron',
  '⌖': 'text-mist',
};

const low = (s: string) => s.charAt(0).toLocaleLowerCase() + s.slice(1);
const isOp = (r: Row): r is Op => (OPS as readonly Row[]).includes(r);

/** «подробнее» stays open for the rest of the visit. */
let detailsOpen = false;

/** A row's glyph and words: the verb read first (mist), the object standing out (bone). */
function rowWords(r: Row): { glyph: Glyph; verb: string; obj?: string } {
  if (isOp(r)) {
    const on = OPERATIONS[r].mode === 'on';
    return {
      glyph: on ? '●' : '⊘',
      verb: t(on ? 'op.on' : 'op.off'),
      obj: t('op.obj', { name: low(t(`op.${r}.name` as Key)) }),
    };
  }
  if (r === 'pick') return { glyph: '⌖', verb: t('op.pick.verb') };
  if (r === 'brain')
    return {
      glyph: opChip('brain', trial.picks).glyph,
      verb: '',
      obj: t('op.pick.kept', { cells: trial.picks ? picksText(trial.picks) : '' }),
    };
  return { glyph: '○', verb: '', obj: t('op.none.verb') };
}

function role(r: Row): string {
  if (isOp(r)) return t(`op.${r}.role` as Key);
  return t(r === 'none' ? 'op.none.role' : 'op.pick.role');
}

/**
 * «Что меняем в мозге» (SURGEON-SHAPE §Layout): the chip (glyph + object + switch) with «вернуть»,
 * and the op list — a popover over the card on desktop, the sheet's body on a phone. Hover / focus
 * previews a row on the hologram (`trial.setPreview`); the strip under the list says what it does.
 */
export const OpPicker = observer(function OpPicker({
  open,
  onToggle,
  phone,
  onPickBrain,
  onForget,
}: {
  open: boolean;
  onToggle: () => void;
  phone: boolean;
  /** «Выбрать любой нейрон в мозге →»: the dive to the brain view with the Silence tool. */
  onPickBrain: () => void;
  /** «вернуть» on the brain picks' chip: forget them. */
  onForget: () => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const chip = opChip(trial.slot, trial.picks);
  const [chipName, chipMode] = chip.text.split(/ · (.*)/s) as [string, string | undefined];
  const setOpen = (v: boolean) => v !== open && onToggle();

  // the hologram grows while the list is open; a closed card lets it go
  useEffect(() => {
    trial.setListing(open);
  }, [open]);
  useEffect(() => () => trial.setListing(false), []);

  const close = () => {
    setOpen(false);
    trial.setListing(false);
    // desktop: the popover hands focus back itself
    if (phone) trigger.current?.focus();
  };
  const choose = (r: Row) => {
    close();
    if (r === 'pick') return onPickBrain();
    trial.setSlot(r);
    // no hover on a phone: the chosen op shows its place, then settles into its mark
    if (phone && r !== 'none') {
      trial.setPreview(r);
      setTimeout(() => {
        if (trial.preview === r && !trial.listing) trial.setPreview(null);
      }, PHONE_PREVIEW_MS);
    }
  };
  const list = <OpList id={id} phone={phone} onChoose={choose} onClose={close} />;

  const value = (
    <span
      key={trial.slot}
      className="flex min-w-0 items-center gap-2 motion-safe:transition-[opacity,scale] motion-safe:duration-180 motion-safe:ease-out motion-safe:starting:scale-96 motion-safe:starting:opacity-0"
    >
      <Mark g={chip.glyph} />
      {/* a narrow row truncates the name, never the switch («· выкл.») */}
      <span className="flex min-w-0">
        <span className="truncate">{chipName}</span>
        {chipMode && <span className="shrink-0 whitespace-pre"> · {chipMode}</span>}
      </span>
    </span>
  );
  /** The trigger and, with something in the slot, «вернуть» beside it. */
  const row = (b: ReactNode) => (
    <div className="flex min-w-0 items-center gap-1">
      {b}
      {/* phone: the closed row is too narrow for both, the open list carries it */}
      {trial.slot !== 'none' && (!phone || open) && (
        <Button
          className="h-8 shrink-0 px-2 text-caption text-mist hover:text-bone motion-safe:transition-[opacity,scale] motion-safe:duration-180 motion-safe:ease-out motion-safe:starting:scale-96 motion-safe:starting:opacity-0"
          onClick={() => (trial.slot === 'brain' ? onForget() : trial.setSlot('none'))}
        >
          {low(t('op.restore'))}
        </Button>
      )}
    </div>
  );
  const button = (
    <Button
      ref={trigger}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? id : undefined}
      className="h-auto min-h-8 min-w-0 flex-1 justify-between gap-2 px-2 py-1 text-left text-label text-bone"
      onClick={phone ? onToggle : undefined}
    >
      {value}
      <span
        aria-hidden="true"
        className={cn(
          'text-caption text-ash transition-transform duration-200 ease-out motion-reduce:transition-none',
          open && 'rotate-180',
        )}
      >
        ▾
      </span>
    </Button>
  );

  return (
    <fieldset
      aria-labelledby={`${id}-l`}
      className={
        phone ? 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1 gap-y-0.5' : 'flex flex-col gap-0.5'
      }
    >
      <h3
        id={`${id}-l`}
        title={phone ? t('exp.change') : undefined}
        className={cn(LABEL, 'px-2', phone && 'w-14')}
      >
        {phone ? t('exp.change.short') : t('exp.change')}
      </h3>
      {phone ? (
        row(button)
      ) : (
        // anchored on the whole row: the list is as wide as the card's inside
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Anchor asChild>{row(<Popover.Trigger asChild>{button}</Popover.Trigger>)}</Popover.Anchor>
          <Popover.Portal>
            <Popover.Content
              side="bottom"
              align="start"
              sideOffset={4}
              collisionPadding={24}
              // the list itself takes focus: arrows move through it
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                document.getElementById(id)?.focus();
              }}
              className={cn(
                'z-30 flex w-(--radix-popover-trigger-width) flex-col overflow-y-auto rounded-lg bg-panel backdrop-blur-md',
                'max-h-(--radix-popover-content-available-height) origin-(--radix-popover-content-transform-origin)',
                'motion-safe:transition-[opacity,translate,scale] motion-safe:duration-160 motion-safe:ease-out',
                'motion-safe:starting:-translate-y-1 motion-safe:starting:scale-98 motion-safe:starting:opacity-0',
                'motion-safe:data-[state=closed]:animate-fade-out',
              )}
            >
              {/* one step lighter than the card */}
              <div className="rounded-lg bg-bone/5 p-1">{list}</div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
      {open && phone && <div className="col-span-2">{list}</div>}
    </fieldset>
  );
});

/** The rows (listbox: ↑↓ Home End move and preview, Enter / Space / click chooses) and the strip. */
const OpList = observer(function OpList({
  id,
  phone,
  onChoose,
  onClose,
}: {
  id: string;
  phone: boolean;
  onChoose: (r: Row) => void;
  onClose: () => void;
}) {
  const rows: Row[] = ['none', ...OPS, ...(trial.picks ? (['brain'] as const) : []), 'pick'];
  const chosen = rows.indexOf(trial.slot);
  // snaps: `?ui=ops:<op>` opens the list on that row
  const [active, setActive] = useState<number | null>(() => {
    const at = rows.indexOf((app.params.ui?.split(':')[1] ?? '') as Row);
    return at >= 0 ? at : null;
  });
  const list = useRef<HTMLDivElement>(null);
  const shown = rows[active ?? chosen] ?? 'none';
  const lit = (i: number | null) => {
    setActive(i);
    const r = i === null ? null : rows[i];
    trial.setPreview(r === undefined || r === null ? null : r === 'pick' ? 'brain' : r);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: on open only
  useEffect(() => {
    if (active !== null) lit(active);
    // the sheet stays scrolled to its top (the slot's label stays in view)
    if (phone) list.current?.focus({ preventScroll: true });
  }, []);

  const onKey = (e: KeyboardEvent) => {
    const n = rows.length;
    const at = active ?? chosen;
    const move: Record<string, number> = {
      ArrowDown: (at + 1) % n,
      ArrowUp: (at - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    if (e.key in move) {
      e.preventDefault();
      lit(move[e.key] as number);
    } else if ((e.key === 'Enter' || e.key === ' ') && rows[at]) {
      e.preventDefault();
      onChoose(rows[at]);
    } else if (e.key === 'Escape' && phone) {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    // leaving the rows and the strip hands the hologram back to the chosen op
    // biome-ignore lint/a11y/noStaticElementInteractions: leaving only drops the preview
    <div
      className="flex flex-col"
      onMouseLeave={() => lit(null)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) lit(null);
      }}
    >
      <div
        ref={list}
        id={id}
        role="listbox"
        tabIndex={0}
        aria-label={t('op.list')}
        aria-activedescendant={active === null ? undefined : `${id}-${active}`}
        onKeyDown={onKey}
        className="flex flex-col outline-none"
      >
        {rows.map((r, i) => {
          const w = rowWords(r);
          return [
            r === 'pick' && <div key="rule" aria-hidden="true" className="mx-2 my-1 h-px w-4 bg-bone/15" />,
            // the listbox keeps focus (`aria-activedescendant`) and takes the keys
            // biome-ignore lint/a11y/useKeyWithClickEvents: keys live on the listbox
            <div
              key={r}
              id={`${id}-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === chosen}
              data-active={i === active || undefined}
              onMouseEnter={() => lit(i)}
              onClick={() => onChoose(r)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 text-label data-active:bg-bone/5',
                phone ? 'min-h-7.5' : 'min-h-6',
              )}
            >
              <Mark g={w.glyph} />
              <span className="min-w-0 flex-1 truncate">
                {w.verb && <span className={r === 'pick' ? 'text-bone' : 'text-mist'}>{w.verb}</span>}
                {w.verb && w.obj && ' '}
                {w.obj && <span className="text-bone">{w.obj}</span>}
              </span>
              {r === 'pick' && (
                <span aria-hidden="true" className="text-mist">
                  →
                </span>
              )}
              {i === chosen && (
                <span aria-hidden="true" className="text-bone">
                  ✓
                </span>
              )}
            </div>,
          ];
        })}
      </div>
      <Strip row={shown} />
    </div>
  );
});

/** The surgeon's glyph, drawn (the font's ⊘ and ⌖ sit smaller than ○ and ●): one size, one stroke. */
function Mark({ g }: { g: Glyph }) {
  return (
    <span aria-hidden="true" className={cn('flex w-3 shrink-0 justify-center', GLYPH_TONE[g])}>
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className="size-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      >
        {g === '●' ? (
          <circle cx="6" cy="6" r="4.5" fill="currentColor" stroke="none" />
        ) : (
          <circle cx="6" cy="6" r="4.4" />
        )}
        {g === '⊘' && <path d="M2.9 9.1 9.1 2.9" />}
        {g === '⌖' && <path d="M6 0v3M6 9v3M0 6h3M9 6h3" />}
      </svg>
    </span>
  );
}

/** What the shown row does (fixed three lines, so the list never jumps), and its technical layer. */
function Strip({ row }: { row: Row }) {
  const [more, setMore] = useState(detailsOpen);
  const toggle = () => {
    detailsOpen = !more;
    setMore(!more);
  };
  const op = isOp(row) ? row : null;
  const link = (k: Key) => (
    <button
      type="button"
      className="cursor-pointer text-ash underline-offset-2 hover:text-bone hover:underline focus-visible:text-bone"
      onClick={toggle}
    >
      {t(k)}
    </button>
  );
  return (
    <div className="mt-1 border-t border-bone/15 px-2 pt-2 pb-1 text-caption text-mist">
      <p
        key={row}
        className="h-[3lh] motion-safe:transition-opacity motion-safe:duration-120 motion-safe:starting:opacity-0"
      >
        {role(row)} {op && !more && link('op.more')}
      </p>
      <div
        className={cn(
          'grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out',
          op && more ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
          {op && <Details op={op}>{link('op.less')}</Details>}
        </div>
      </div>
    </div>
  );
}

function Details({ op, children }: { op: Op; children: ReactNode }) {
  return (
    <>
      <span className="font-mono text-ash">{t(`op.${op}.term` as Key)}</span>
      <span>{t(`op.${op}.fact` as Key)}</span>
      <span className="text-ash">
        {t(GUESS.has(op) ? 'op.src.guess.long' : 'op.src.data.long')} {children}
      </span>
    </>
  );
}
