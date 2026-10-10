import { OPERATIONS } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import { type ReactNode, type Ref, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { type Key, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { CARD_STIMULI, type CardStimulus, DISCOVERIES } from '@/scene/dish/discoveries';
import type { Brain } from '@/scene/dish/table';
import { OPS, type Op } from '@/scene/dish/verdict';
import { dish } from '@/state/dish';
import { type Outcome, trial } from '@/state/trial';
import { GLYPH } from './DishPalette';
import { betLine, headline, isHe, nowLine, usualLine } from './expText';

/** Mono term per operation (as on the old cards). */
const ID: Record<Op, string> = { panic: 'DNp01', moon: 'MDN', sugar: 'LB3', p1: 'P1' };
/** Types inferred, not named in the dataset (LB3 = sugar, pC1 = P1): source chip «inferred». */
const GUESS: ReadonlySet<Op> = new Set(['sugar', 'p1']);
/** The swatter lands this long after the run starts, sim s (as in free play). */
const SWAT_S = 0.12;

const LABEL = 'font-mono text-caption tracking-widest text-ash uppercase';

export const stimName = (s: CardStimulus): string =>
  t(s === 'none' ? 'exp.give.none' : s === 'shadow' || s === 'swatter' ? `dish.hand.${s}` : `dish.item.${s}`);

const opMode = (op: Op) => OPERATIONS[op].mode;
const opName = (op: Op) => t(`op.${op}.name` as Key);

/** A slot: label, the chosen value as a ghost select, its list under it while open. */
function Slot({
  label,
  value,
  sub,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    // a pick or Esc closes the list and hands focus back to the slot
    <fieldset
      aria-labelledby={`${id}-l`}
      className="flex flex-col gap-0.5"
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !open) return;
        e.stopPropagation();
        onToggle();
        trigger.current?.focus();
      }}
    >
      <h3 id={`${id}-l`} className={cn(LABEL, 'px-2')}>
        {label}
      </h3>
      <Button
        ref={trigger}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className="h-auto min-h-8 w-full justify-between gap-2 px-2 py-1 text-left text-label whitespace-normal text-bone"
        onClick={onToggle}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">{value}</span>
          {sub && <span className="text-caption text-ash">{sub}</span>}
        </span>
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
      {open && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: the options are buttons; this only moves focus after a pick
        <ul
          id={id}
          onClick={() => trigger.current?.focus()}
          className="flex flex-col gap-0.5 rounded-lg bg-bone/5 p-1 motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:-translate-y-1 motion-safe:starting:opacity-0"
        >
          {children}
        </ul>
      )}
    </fieldset>
  );
}

function Option({ on, onPick, children }: { on: boolean; onPick: () => void; children: ReactNode }) {
  return (
    <li>
      <Button
        aria-pressed={on}
        className="group h-auto w-full flex-col items-stretch gap-0.5 px-2 py-1.5 text-left whitespace-normal text-mist hover:bg-bone/5 hover:text-bone aria-pressed:text-bone"
        onClick={onPick}
      >
        {children}
      </Button>
    </li>
  );
}

const Give = observer(function Give({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const s = trial.stim;
  const pick = (x: CardStimulus) => {
    trial.setStim(x);
    onToggle();
  };
  return (
    <Slot
      label={t('exp.give')}
      open={open}
      onToggle={onToggle}
      value={
        s ? (
          <>
            {s !== 'none' && <span className={cn('[&_svg]:size-4', GLYPH[s].tone)}>{GLYPH[s].icon}</span>}
            {stimName(s)}
          </>
        ) : (
          <span className="text-ash">{t('exp.give.empty')}</span>
        )
      }
      sub={s ? t(`pal.does.${s}`) : undefined}
    >
      {CARD_STIMULI.map((x) => (
        <Option key={x} on={s === x} onPick={() => pick(x)}>
          <span className="flex items-center gap-2 text-label">
            {x !== 'none' && <span className={cn('[&_svg]:size-4', GLYPH[x].tone)}>{GLYPH[x].icon}</span>}
            {stimName(x)}
          </span>
          <span className="text-caption text-ash">{t(`pal.does.${x}`)}</span>
        </Option>
      ))}
    </Slot>
  );
});

const Change = observer(function Change({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const op = trial.op;
  const pick = (x: Brain) => {
    trial.setOp(x);
    onToggle();
  };
  return (
    <Slot
      label={t('exp.change')}
      open={open}
      onToggle={onToggle}
      value={
        <>
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              op === 'none' ? 'ring-1 ring-ash/60' : 'bg-saffron',
            )}
          />
          {op === 'none' ? t('exp.op.none') : opName(op)}
        </>
      }
      sub={op === 'none' ? undefined : `${t(opMode(op) === 'on' ? 'exp.op.on' : 'exp.op.off')} · ${ID[op]}`}
    >
      <Option on={op === 'none'} onPick={() => pick('none')}>
        <span className="text-label">{t('exp.op.none')}</span>
      </Option>
      {OPS.map((x) => (
        <Option key={x} on={op === x} onPick={() => pick(x)}>
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-label">{opName(x)}</span>
            <span className="font-mono text-caption text-ash">{ID[x]}</span>
          </span>
          <span className="text-caption text-mist">{t(`op.${x}.role` as Key)}</span>
          {/* the chosen op's fact: the list stays short and still */}
          <span className="hidden text-caption text-ash group-aria-pressed:block">
            {t(`op.${x}.fact` as Key)}
          </span>
          <span className="font-mono text-caption text-ash">
            {t(opMode(x) === 'on' ? 'exp.op.on' : 'exp.op.off')} ·{' '}
            {t(GUESS.has(x) ? 'op.src.guess' : 'op.src.data')}
          </span>
        </Option>
      ))}
    </Slot>
  );
});

const Bet = observer(function Bet() {
  const stim = trial.stim;
  if (!stim || !trial.needsBet) return null;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={cn(LABEL, 'px-2 pb-1')}>{t(isHe(stim) ? 'exp.bet.he' : 'exp.bet.she')}</legend>
      <div className="flex flex-wrap gap-1 px-1">
        {trial.chips.map((r) => (
          <Button
            key={r}
            aria-pressed={trial.bet === r}
            className="h-8 rounded-full px-3 text-caption text-mist ring-1 ring-bone/30 hover:text-bone aria-pressed:text-bone aria-pressed:ring-saffron"
            onClick={() => trial.setBet(trial.bet === r ? null : r)}
          >
            {t(`exp.act.${r}` as Key)}
          </Button>
        ))}
      </div>
    </fieldset>
  );
});

const Setup = observer(function Setup() {
  const [open, setOpen] = useState<'give' | 'change' | null>(null);
  const toggle = (k: 'give' | 'change') => setOpen(open === k ? null : k);
  const live = dish.cells !== null;
  return (
    <>
      <Give open={open === 'give'} onToggle={() => toggle('give')} />
      <div className="flex flex-col gap-0.5">
        <Change open={open === 'change'} onToggle={() => toggle('change')} />
        {dish.brain && (
          <p className="px-2 text-caption text-ash">
            {t('exp.brainOps', { cells: t('op.brain.cells', dish.brain) })}
          </p>
        )}
      </div>
      <Bet />
      <Button
        variant="primary"
        className="self-end"
        disabled={!live || !trial.canRun}
        onClick={() => trial.start()}
      >
        {live ? t('exp.run') : t('exp.loading')}
      </Button>
    </>
  );
});

/** One line: what we give × what we changed. */
function summary(stim: CardStimulus, op: Brain): string {
  const o =
    op === 'none' ? '' : ` · ${opName(op)} ${t(opMode(op) === 'on' ? 'exp.op.onShort' : 'exp.op.offShort')}`;
  return `${stimName(stim)}${o}`;
}

const Running = observer(function Running({ progress }: { progress: Ref<HTMLDivElement> }) {
  const stim = trial.stim;
  if (!stim) return null;
  return (
    <>
      <p className="px-2 text-label text-bone">{summary(stim, trial.op)}</p>
      <p className="px-2 text-caption text-mist">
        {t('exp.running', { what: t(`exp.deliver.${stim}` as Key, { t: SWAT_S }) })}
      </p>
      {/* sim time / timeout: `style.scale` written from the frame loop */}
      <div className="mx-2 h-px bg-bone/15">
        <div ref={progress} className="h-full origin-left scale-x-0 bg-bone/70" />
      </div>
      <Button
        aria-keyshortcuts="Escape"
        className="h-8 self-end px-2 text-caption"
        onClick={() => trial.stop()}
      >
        {t('exp.stop')}
      </Button>
    </>
  );
});

const Result = observer(function Result({ o }: { o: Outcome }) {
  const bet = betLine(o);
  return (
    <>
      <p className="px-2 text-body leading-tight text-bone">{headline(o)}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-2 text-caption tabular-nums">
        <dt className="font-mono text-ash">{t(dish.brain ? 'exp.usual.noops' : 'exp.usual')}</dt>
        <dd className="text-ash">{usualLine(o.norm)}</dd>
        <dt className="font-mono text-mist">{t('exp.now')}</dt>
        <dd className="text-bone">{nowLine(o)}</dd>
        {bet && (
          <>
            <dt className="font-mono text-ash">{t('exp.bet')}</dt>
            <dd className={o.first ? 'text-mist' : 'text-ash'}>{bet}</dd>
          </>
        )}
      </dl>
      {o.unlocked && (
        <p className="px-2 text-label text-saffron">
          {t('exp.unlock', {
            n: trial.found.length,
            of: DISCOVERIES.length,
            title: t(`found.${o.unlocked.stim}.${o.unlocked.op}` as Key),
          })}
        </p>
      )}
      <div className="flex justify-end gap-1">
        <Button className="h-8 px-2 text-caption text-mist" onClick={() => trial.again()}>
          {t('exp.again')}
        </Button>
        <Button className="h-8 px-2 text-caption text-mist" onClick={() => trial.fresh()}>
          {t('exp.new')}
        </Button>
      </div>
    </>
  );
});

/**
 * The experiment card (EXPERIMENT-SHAPE §Card): what the fly gets × what we change in her brain,
 * the bet, «Запустить», the run and its result next to the norm. Desktop: the right column.
 */
export const DishCard = observer(function DishCard({ progress }: { progress: Ref<HTMLDivElement> }) {
  const o = trial.outcome;
  const head = useRef<HTMLHeadingElement>(null);
  const card = useRef<HTMLElement>(null);
  const phase = trial.phase;
  // the button that was pressed unmounts with its phase: keep focus in the card
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on a phase change
  useEffect(() => {
    const a = document.activeElement;
    if (a === document.body || (a && card.current?.contains(a) && !a.isConnected)) head.current?.focus();
  }, [phase, o]);
  return (
    <section
      ref={card}
      data-band-right
      aria-label={t('exp.tab')}
      className="pointer-events-auto absolute top-24 right-8 z-10 hidden max-h-[calc(100%-14rem)] w-57 flex-col gap-3 overflow-y-auto rounded-xl bg-panel p-2 backdrop-blur-md md:flex"
    >
      <header className="flex items-baseline gap-2 px-2 pt-1 text-label">
        <h2 ref={head} tabIndex={-1} className="text-bone outline-none">
          {t('exp.tab')}
        </h2>
        <span aria-hidden="true" className="text-ash">
          ·
        </span>
        <span className="text-ash tabular-nums">
          {t('exp.found.tab', { n: trial.found.length, of: DISCOVERIES.length })}
        </span>
      </header>
      {trial.phase === 'running' ? <Running progress={progress} /> : o ? <Result o={o} /> : <Setup />}
      <p role="status" className="sr-only">
        {o && `${headline(o)}. ${t('exp.now')}: ${nowLine(o)}`}
      </p>
    </section>
  );
});
