import { OPERATIONS } from '@fly/sim';
import { observer } from 'mobx-react-lite';
import {
  createContext,
  type ReactNode,
  type Ref,
  type RefObject,
  type UIEvent,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { type Key, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { CARD_STIMULI, type CardStimulus, DISCOVERIES, type Discovery } from '@/scene/dish/discoveries';
import type { Brain } from '@/scene/dish/table';
import { OPS, type Op } from '@/scene/dish/verdict';
import { app } from '@/state/app';
import { dish } from '@/state/dish';
import { onboarding } from '@/state/onboarding';
import { type CardTab, type Outcome, trial } from '@/state/trial';
import { loadPct } from '@/state/welcome';
import { DishFound } from './DishFound';
import { GLYPH, type PaletteInput, PutPanel } from './DishPalette';
import { betLine, headline, OP_CELL as ID, isHe, nowLine, scaleRow, usualLine } from './expText';
import { ReplayCaption } from './ReplayCaption';
import { blink, scaleLine } from './scale';

/** Types inferred, not named in the dataset (LB3 = sugar, pC1 = P1): source chip «inferred». */
const GUESS: ReadonlySet<Op> = new Set(['sugar', 'p1']);
/** The swatter lands this long after the run starts, sim s (as in free play). */
const SWAT_S = 0.12;

const LABEL = 'font-mono text-caption tracking-widest text-ash uppercase';
/** Phone, a short screen: what gives way first. */
const SHORT = '[@media(max-height:759px)]:hidden';

/** The card sits in the phone's sheet (EXPERIMENT-SHAPE §Phone): rows, not stacks. */
const Phone = createContext(false);

export const stimName = (s: CardStimulus): string =>
  t(s === 'none' ? 'exp.give.none' : s === 'shadow' || s === 'swatter' ? `dish.hand.${s}` : `dish.item.${s}`);

const opMode = (op: Op) => OPERATIONS[op].mode;
const opName = (op: Op) => t(`op.${op}.name` as Key);

/** A slot: label, the chosen value as a ghost select, its list under it while open. */
function Slot({
  label,
  short,
  value,
  sub,
  open,
  onToggle,
  children,
}: {
  label: string;
  /** Phone: the row's label («Даём»). */
  short: string;
  value: ReactNode;
  sub?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const phone = useContext(Phone);
  return (
    // a pick or Esc closes the list and hands focus back to the slot
    <fieldset
      aria-labelledby={`${id}-l`}
      className={
        phone ? 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1 gap-y-0.5' : 'flex flex-col gap-0.5'
      }
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !open) return;
        e.stopPropagation();
        onToggle();
        trigger.current?.focus();
      }}
    >
      <h3 id={`${id}-l`} title={phone ? label : undefined} className={cn(LABEL, 'px-2', phone && 'w-14')}>
        {phone ? short : label}
      </h3>
      <Button
        ref={trigger}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={cn(
          'h-auto w-full justify-between gap-2 px-2 py-1 text-left text-label whitespace-normal text-bone',
          'min-h-8',
        )}
        onClick={onToggle}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          {/* phone: one line, the list says the rest */}
          <span className="flex items-center gap-2">{value}</span>
          {sub && !phone && <span className="text-caption text-ash">{sub}</span>}
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
          className={cn(
            'flex flex-col gap-0.5 rounded-lg bg-bone/5 p-1',
            phone && 'col-span-2',
            'motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:-translate-y-1 motion-safe:starting:opacity-0',
          )}
        >
          {children}
        </ul>
      )}
      {/* phone: the list stands in for the card's body; «готово» brings the rest back */}
      {open && phone && (
        <Button
          aria-keyshortcuts="Escape"
          className="col-span-2 h-8 justify-self-end px-3 text-caption text-mist"
          onClick={() => {
            onToggle();
            trigger.current?.focus();
          }}
        >
          {t('exp.done')}
        </Button>
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
  const phone = useContext(Phone);
  const pick = (x: CardStimulus) => {
    trial.setStim(x);
    onToggle();
  };
  return (
    <Slot
      label={t('exp.give')}
      short={t('exp.give.short')}
      open={open}
      onToggle={onToggle}
      value={
        s ? (
          <>
            {s !== 'none' && <span className={cn('[&_svg]:size-4', GLYPH[s].tone)}>{GLYPH[s].icon}</span>}
            <span className={cn(phone && 'truncate')}>{stimName(s)}</span>
          </>
        ) : (
          <span className="text-ash">{t(phone ? 'exp.give.pick' : 'exp.give.empty')}</span>
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
  const phone = useContext(Phone);
  const pick = (x: Brain) => {
    trial.setOp(x);
    onToggle();
  };
  return (
    <Slot
      label={t('exp.change')}
      short={t('exp.change.short')}
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
          <span className={cn(phone && 'truncate')}>{op === 'none' ? t('exp.op.none') : opName(op)}</span>
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
          <span
            className={cn(
              'hidden text-caption text-ash group-aria-pressed:block',
              phone && '[@media(max-height:759px)]:group-aria-pressed:hidden',
            )}
          >
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
  const phone = useContext(Phone);
  const stim = trial.stim;
  if (!stim || !trial.needsBet) return null;
  const step = onboarding.step;
  const onb = step === 1 ? 'onb.1' : step === 3 ? 'onb.3' : null;
  return (
    <fieldset
      // phone: the onboarding's question is the point of the step, scroll the sheet to it
      ref={(el) => {
        if (el && onb && phone) el.scrollIntoView({ block: 'start' });
      }}
      className="flex flex-col gap-1.5"
    >
      {/* the onboarding's line asks the question itself */}
      {onb ? (
        <legend className="px-2 pb-1 text-body leading-tight text-bone">{t(onb)}</legend>
      ) : (
        <legend className={cn(LABEL, 'px-2 pb-1')}>{t(isHe(stim) ? 'exp.bet.he' : 'exp.bet.she')}</legend>
      )}
      <div className="flex flex-wrap gap-1 px-1">
        {trial.chips.map((r) => (
          <Button
            key={r}
            aria-pressed={trial.bet === r}
            // phone: three chips in one row of the sheet
            className={cn(
              'h-8 rounded-full text-caption text-mist ring-1 ring-bone/30 hover:text-bone aria-pressed:text-bone aria-pressed:ring-saffron',
              phone ? 'px-2' : 'px-3',
            )}
            onClick={() => trial.setBet(trial.bet === r ? null : r)}
          >
            {t(`exp.act.${r}` as Key)}
          </Button>
        ))}
      </div>
    </fieldset>
  );
});

const Setup = observer(function Setup({ onClearBrain }: { onClearBrain: () => void }) {
  const [open, setOpen] = useState<'give' | 'change' | null>(null);
  const toggle = (k: 'give' | 'change') => setOpen(open === k ? null : k);
  const live = dish.cells !== null;
  // phone: an open slot's list is the whole body (same tree, so focus stays on its trigger)
  const phone = useContext(Phone);
  const solo = phone && open !== null;
  const more = useMore();
  const whyId = useId();
  // what still keeps «Запустить» off
  const why = !live || trial.canRun ? null : t(trial.stim ? 'exp.why.bet' : 'exp.why.stim');
  return (
    <>
      {/* phone: the slots and the bet scroll, «Запустить» stays in view under them */}
      <div
        {...more}
        className={
          phone ? cn('-mx-2 flex min-h-0 flex-col gap-3 overflow-y-auto px-2 pb-1', MORE) : 'contents'
        }
      >
        {(!solo || open === 'give') && <Give open={open === 'give'} onToggle={() => toggle('give')} />}
        {(!solo || open === 'change') && (
          <div className="relative flex flex-col gap-0.5">
            {onboarding.step === 3 && <Glow />}
            <Change open={open === 'change'} onToggle={() => toggle('change')} />
            {dish.brain && !solo && (
              <div className="flex items-center justify-between gap-1 pl-2">
                <p className="text-caption text-ash">
                  {t('exp.brainOps', { cells: t('op.brain.cells', dish.brain) })}
                </p>
                <Button className="h-8 px-2 text-caption text-mist" onClick={onClearBrain}>
                  {t('op.restore')}
                </Button>
              </div>
            )}
          </div>
        )}
        {!solo && <Bet />}
      </div>
      {!solo && (
        <div className="flex items-center gap-1">
          {onboarding.step !== 0 ? (
            <Skip />
          ) : (
            why && (
              <p id={whyId} className="px-2 text-caption text-ash">
                {why}
              </p>
            )
          )}
          <Button
            variant="primary"
            className="ml-auto"
            aria-describedby={why && onboarding.step === 0 ? whyId : undefined}
            disabled={!live || !trial.canRun}
            onClick={() => trial.start()}
          >
            {live ? t('exp.run') : runLoading()}
          </Button>
        </div>
      )}
    </>
  );
});

/** Onboarding step 3: the op slot lights up once (a saffron hairline, opacity only). */
function Glow() {
  const el = useRef<HTMLSpanElement>(null);
  const still = app.reducedMotion;
  useEffect(() => {
    if (still) return;
    const a = el.current?.animate({ opacity: [0, 1, 0] }, { duration: 1200, easing: 'ease-in-out' });
    return () => a?.cancel();
  }, []);
  return (
    <span
      ref={el}
      aria-hidden="true"
      // reduced motion: the ring just stays for the step
      className={cn(
        'pointer-events-none absolute -inset-0.5 rounded-lg ring-1 ring-saffron',
        still ? 'opacity-60' : 'opacity-0',
      )}
    />
  );
}

const Skip = ({ className }: { className?: string }) => (
  <Button
    className={cn('h-8 px-2 text-caption text-mist hover:text-bone', className)}
    onClick={() => onboarding.skip()}
  >
    {t('onb.skip')}
  </Button>
);

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

/** Sends a copy of the ✦ over to the tab counter (on-screen move: ease-in-out). */
function fly(from: HTMLElement, to: HTMLElement): Animation {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const star = from.cloneNode(true) as HTMLElement;
  star.setAttribute('aria-hidden', 'true');
  const { fontSize, lineHeight } = getComputedStyle(from);
  Object.assign(star.style, {
    fontSize,
    lineHeight,
    position: 'fixed',
    left: `${a.left}px`,
    top: `${a.top}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: '50',
  });
  document.body.append(star);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const ease = getComputedStyle(document.documentElement).getPropertyValue('--ease-in-out').trim();
  const anim = star.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.3 },
    ],
    { duration: 520, delay: 250, easing: ease || 'ease-in-out', fill: 'forwards' },
  );
  const drop = () => star.remove();
  anim.addEventListener('finish', drop);
  anim.addEventListener('cancel', drop);
  return anim;
}

/** «✦ Открытие n/12: …»; on show the ✦ travels to the counter, which ticks when it lands. */
function Unlock({ o, to, onLand }: { o: Outcome; to: RefObject<HTMLElement | null>; onLand?: () => void }) {
  const star = useRef<HTMLSpanElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per unlock line
  useEffect(() => {
    const from = star.current;
    const target = to.current;
    // landed already (the line comes back after a replay or the other tab)
    if (!onLand) return;
    if (!from || !target || app.reducedMotion || app.params.snap) return onLand();
    const anim = fly(from, target);
    anim.addEventListener('finish', onLand);
    // gone mid-flight: the card ticks the counter itself once the result is left
    return () => anim.cancel();
  }, []);
  if (!o.unlocked) return null;
  return (
    <p className="px-2 text-label text-saffron">
      <span ref={star} aria-hidden="true" className="inline-block text-saffron">
        ✦
      </span>{' '}
      {unlockLine(o.unlocked)}
    </p>
  );
}

const Result = observer(function Result({
  o,
  counter,
  onLand,
}: {
  o: Outcome;
  counter: RefObject<HTMLElement | null>;
  onLand?: () => void;
}) {
  const bet = betLine(o);
  const step = onboarding.step;
  // phone, a short screen: a repeat run's bet gives way
  const tight = useContext(Phone) && !o.first && SHORT;
  // a feel for the number, under the row it comes from
  const scale = scaleRow(o);
  const cmp = scale && blink(scale.ms);
  const gloss = scale && cmp && (
    <dd className="col-start-2 text-mist">
      <span className="font-mono">{t('unit.ms', { v: scale.ms })}</span> — {cmp}
    </dd>
  );
  return (
    <>
      <p className="px-2 text-body leading-tight text-bone">{headline(o)}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-2 text-caption tabular-nums">
        <dt className="font-mono text-ash">{t(dish.brain ? 'exp.usual.noops' : 'exp.usual')}</dt>
        <dd className="text-ash">{usualLine(o.norm)}</dd>
        {scale?.row === 'usual' && gloss}
        <dt className="font-mono text-mist">{t('exp.now')}</dt>
        <dd className="text-bone">{nowLine(o)}</dd>
        {scale?.row === 'now' && gloss}
        {bet && (
          <>
            <dt className={cn('font-mono text-ash', tight)}>{t('exp.bet')}</dt>
            <dd className={cn(o.first ? 'text-mist' : 'text-ash', tight)}>{bet}</dd>
          </>
        )}
      </dl>
      {o.unlocked && <Unlock o={o} to={counter} onLand={onLand} />}
      {step === 2 || step === 4 ? (
        <OnbResult step={step} />
      ) : (
        <div className="flex items-center gap-1">
          {dish.recorded && (
            <Button variant="primary" aria-keyshortcuts="W" onClick={() => trial.replay()}>
              {t('exp.replay')}
            </Button>
          )}
          <Button className="ml-auto h-8 px-2 text-caption text-mist" onClick={() => trial.again()}>
            {t('exp.again')}
          </Button>
          <Button className="h-8 px-2 text-caption text-mist" onClick={() => trial.fresh()}>
            {t('exp.new')}
          </Button>
        </div>
      )}
    </>
  );
});

/** Onboarding after a result: step 2 leads on to the operation, step 4 hands the card over. */
function OnbResult({ step }: { step: 2 | 4 }) {
  // phone: the stimuli are under «Положить», not on the left
  const phone = useContext(Phone);
  return (
    <>
      <p role="status" className="px-2 text-body leading-tight text-bone">
        {t(step === 2 ? 'onb.2' : phone ? 'onb.4.phone' : 'onb.4')}
      </p>
      {/* the long pill takes its own line when the card is narrow, «пропустить» under it */}
      <div className="flex flex-wrap-reverse items-center justify-end gap-1">
        {step === 2 ? (
          <>
            <Skip className="mr-auto" />
            <Button variant="primary" onClick={() => onboarding.next()}>
              {t('onb.2.pill')}
            </Button>
          </>
        ) : (
          <>
            {dish.recorded && (
              <Button variant="primary" aria-keyshortcuts="W" onClick={() => trial.replay()}>
                {t('exp.replay')}
              </Button>
            )}
            <Button className="ml-auto h-8 px-2 text-caption text-mist" onClick={() => onboarding.finish()}>
              {t('onb.ok')}
            </Button>
          </>
        )}
      </div>
    </>
  );
}

/** The replay's side of the card: its caption and the way back to the result. */
function Replay() {
  const phone = useContext(Phone);
  return (
    <>
      <ReplayCaption />
      {/* phone: the scrubber's own «Закрыть» */}
      {!phone && (
        <Button
          variant="primary"
          aria-keyshortcuts="Escape"
          className="self-end"
          onClick={() => trial.closeReplay()}
        >
          {t('exp.replay.close')}
        </Button>
      )}
    </>
  );
}

/**
 * The experiment card (EXPERIMENT-SHAPE §Card): what the fly gets × what we change in her brain,
 * the bet, «Запустить», the run and its result next to the norm. Desktop: the right column. Phone
 * (`input` given): the sheet over the wordmark, with «Положить» as a third tab; its tabs step
 * aside while a run or replay is on.
 */
export const DishCard = observer(function DishCard({
  progress,
  input,
  onClearBrain,
}: {
  progress: Ref<HTMLDivElement>;
  input?: PaletteInput;
  /** Undo what the brain view carried back. */
  onClearBrain: () => void;
}) {
  const phone = !!input;
  const o = trial.outcome;
  const head = useRef<HTMLHeadingElement>(null);
  const card = useRef<HTMLElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const { phase, replaying, tab } = trial;
  const n = trial.found.length;
  // the counter holds the old number while the ✦ is on its way (`Unlock` lands it)
  const [shown, setShown] = useState(n);
  // the number slides in on a tick, not on load
  const first = useRef(n);
  const ticked = shown !== first.current;
  const put = phone && dish.put;
  const fade = useMore();
  const flying = !!o?.unlocked && phase === 'result' && !replaying && tab === 'exp' && !put;
  useEffect(() => {
    if (!flying) setShown(n);
  }, [n, flying]);
  // the button that was pressed unmounts with its phase: keep focus in the card
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on a phase change
  useEffect(() => {
    const a = document.activeElement;
    if (a === document.body || (a && card.current?.contains(a) && !a.isConnected)) head.current?.focus();
  }, [phase, o, replaying, tab, put, onboarding.step]);
  const locked = phase === 'running' || replaying;
  const at: SheetTab = put && !locked ? 'put' : tab;
  return (
    <Phone.Provider value={phone}>
      <section
        ref={card}
        data-card
        data-band-right={phone ? undefined : true}
        aria-label={t('exp.tab')}
        className={cn(
          'pointer-events-auto flex flex-col overflow-hidden rounded-xl bg-panel p-2 backdrop-blur-md',
          phone
            ? 'max-h-[42svh] gap-1 [@media(max-height:759px)]:max-h-[38svh]'
            : 'absolute top-24 right-8 z-10 max-h-[calc(100%-14rem)] w-57 gap-3',
        )}
      >
        {/* where focus lands when the pressed button goes away: unseen, the tabs come next */}
        <h2 ref={head} tabIndex={-1} className="sr-only">
          {t('exp.tab')}
        </h2>
        <Tabs tab={at} tabs={phone ? SHEET_TABS : TABS} locked={locked} hidden={phone && locked}>
          <span ref={counter} className={cn('inline-flex overflow-hidden', trial.allFound && 'text-saffron')}>
            {/* keyed: each tick slides the new number in */}
            <span
              key={shown}
              className={cn(
                ticked &&
                  'motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0',
              )}
            >
              {t('exp.found.tab', { n: shown, of: DISCOVERIES.length })}
            </span>
          </span>
        </Tabs>
        <div
          {...fade}
          role="tabpanel"
          id={`card-${at}`}
          // the phone's run / replay has no tabs over it
          aria-labelledby={phone && locked ? undefined : `tab-${at}`}
          aria-label={phone && locked ? t('exp.tab') : undefined}
          // the tabs stay put; the panel scrolls (12 tiles outgrow the card)
          className={cn('-mx-2 -mb-2 flex min-h-0 flex-col gap-3 overflow-y-auto px-2 pb-2', MORE)}
        >
          {at === 'put' && input ? (
            <PutPanel input={input} />
          ) : at === 'found' ? (
            <DishFound />
          ) : phase === 'running' ? (
            <Running progress={progress} />
          ) : o && replaying ? (
            <Replay />
          ) : o ? (
            <Result
              o={o}
              counter={counter}
              onLand={shown < n ? () => setShown(trial.found.length) : undefined}
            />
          ) : (
            <Setup onClearBrain={onClearBrain} />
          )}
        </div>
        <p role="status" className="sr-only">
          {o &&
            `${headline(o)}. ${t('exp.now')}: ${nowLine(o)}${nowScale(o)}${o.unlocked ? `. ${unlockLine(o.unlocked)}` : ''}`}
        </p>
      </section>
    </Phone.Provider>
  );
});

/** `data-more` while a scroller has more below its fold. */
function markMore(el: HTMLElement): void {
  el.toggleAttribute('data-more', el.scrollHeight - el.scrollTop - el.clientHeight > 4);
}

/** «. 8 мс — в 12 раз быстрее моргания» for the live region, when the run has its own latency. */
function nowScale(o: Outcome): string {
  const s = scaleRow(o);
  const line = s?.row === 'now' ? scaleLine(s.ms) : null;
  return line ? `. ${line}` : '';
}

/** More below: the bottom 1.5rem fades out (3rem ate a whole chip row in a 700-tall sheet). */
const MORE = 'data-more:[mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]';

/** A scroller's `data-more`, re-measured after each render and on any resize of it or its content. */
function useMore() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    markMore(el);
    const ro = new ResizeObserver(() => markMore(el));
    ro.observe(el);
    for (const c of el.children) ro.observe(c);
    return () => ro.disconnect();
  });
  return { ref, onScroll: (e: UIEvent<HTMLDivElement>) => markMore(e.currentTarget) };
}

/** The phone sheet's tabs: the card's two and «Положить» between them. */
type SheetTab = CardTab | 'put';
const TABS: readonly SheetTab[] = ['exp', 'found'];
const SHEET_TABS: readonly SheetTab[] = ['exp', 'put', 'found'];
const TAB_LABEL: Record<Exclude<SheetTab, 'found'>, Key> = { exp: 'exp.tab', put: 'dish.items' };

/**
 * «Опыт · Открытия n/12» (phone: «Опыт · Положить · Открытия n/12»): ghost-word tabs; ←/→ move
 * between them, locked while a run or replay is on (phone: `hidden` then).
 */
function Tabs({
  tab,
  tabs,
  locked,
  hidden,
  children,
}: {
  tab: SheetTab;
  tabs: readonly SheetTab[];
  locked: boolean;
  hidden: boolean;
  children: ReactNode;
}) {
  const refs = useRef<Partial<Record<SheetTab, HTMLButtonElement | null>>>({});
  const phone = tabs.length > 2;
  const go = (k: SheetTab) => {
    dish.setPut(k === 'put');
    if (k !== 'put') trial.setTab(k);
    refs.current[k]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={t('exp.tab')}
      // kept mounted while hidden: the ✦'s counter lives in it
      hidden={hidden}
      className={cn('flex items-baseline gap-1 px-1 text-label', phone ? 'justify-center' : 'pt-1')}
      onKeyDown={(e) => {
        if (locked || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        const n = tabs.length;
        const i = tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
        go(tabs[(i + n) % n] as SheetTab);
      }}
    >
      {tabs.map((k, i) => (
        <span key={k} className="flex items-baseline gap-1">
          {i > 0 && (
            <span aria-hidden="true" className="text-ash">
              ·
            </span>
          )}
          <button
            ref={(el) => {
              refs.current[k] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${k}`}
            aria-selected={k === tab}
            // only the selected tab's panel is mounted
            aria-controls={k === tab ? `card-${k}` : undefined}
            aria-disabled={locked && k !== tab}
            tabIndex={k === tab ? 0 : -1}
            className={cn(
              'rounded-md px-1 tabular-nums outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-bone/60',
              phone ? 'h-8 px-1.5 whitespace-nowrap' : 'min-h-4',
              k === tab ? 'text-bone' : 'text-ash hover:text-mist',
              locked && k !== tab && 'pointer-events-none',
            )}
            onClick={() => !locked && go(k)}
          >
            {k === 'found' ? children : t(TAB_LABEL[k])}
          </button>
        </span>
      ))}
    </div>
  );
}

/** «Открытие n/12: …» — the result's line and its announcement. */
function unlockLine(d: Discovery): string {
  return t('exp.unlock', {
    n: trial.found.length,
    of: DISCOVERIES.length,
    title: t(`found.${d.stim}.${d.op}` as Key),
  });
}

/** The run pill until the brain is up: the welcome's percentage carries over (WELCOME-SHAPE §Progress). */
function runLoading(): string {
  const pct = loadPct(dish.loading, false);
  return typeof pct === 'number' ? t('exp.loadingPct', { pct }) : t('exp.loading');
}
