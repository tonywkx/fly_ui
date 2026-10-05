import { observer } from 'mobx-react-lite';
import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { data } from '@/data/store';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import { TRACE_MAX_HOPS, trace } from '@/state/trace';

/** Two significant digits: path fractions span orders of magnitude (0.22%, 0.011%); no exponents. */
const percent = (f: number) => (f >= 1e-5 ? `${(f * 100).toPrecision(2)}%` : '<0.001%');

/**
 * Trace tool options: From / To cell types (typed, or set by clicking neurons) and the strongest
 * paths between them through this circuit; the chosen one lights up hop by hop in the scene.
 */
export const Tracer = observer(function Tracer() {
  const meta = data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  const types = useMemo(() => (meta ? [...meta.strings.types].sort() : []), [meta]);
  const listId = useId();
  const { from, to, status, paths } = trace;
  return (
    <>
      <datalist id={listId}>
        {types.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <div className="grid grid-cols-[1fr_auto] items-end gap-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <EndField
            label={t('trace.from')}
            value={from}
            list={listId}
            types={types}
            onCommit={(t) => trace.setEnds(t, to)}
          />
          <EndField
            label={t('trace.to')}
            value={to}
            list={listId}
            types={types}
            onCommit={(t) => trace.setEnds(from, t)}
          />
        </div>
        <Button
          aria-label={t('trace.swap')}
          title={t('trace.swap')}
          className="size-5 px-0 text-caption"
          disabled={!from && !to}
          onClick={() => trace.swap()}
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-3 fill-none stroke-current" strokeWidth={1.5}>
            <path d="M5 13V3M2.5 5.5L5 3l2.5 2.5M11 3v10M8.5 10.5L11 13l2.5-2.5" />
          </svg>
        </Button>
      </div>
      <p aria-live="polite" className="text-caption text-mist empty:hidden">
        {status === 'loading'
          ? t('trace.finding')
          : status === 'failed'
            ? t('trace.failed')
            : status === 'done' && paths.length === 0
              ? t('trace.noPath', { n: TRACE_MAX_HOPS })
              : ''}
      </p>
      {status === 'done' && paths.length > 0 && (
        <ol
          aria-label={t('trace.paths')}
          className={cn(
            'flex max-h-36 flex-col gap-0.5 overflow-y-auto overscroll-contain',
            'transition-opacity duration-150 ease-out starting:opacity-0',
            app.params.snap && 'transition-none',
          )}
        >
          {paths.map((p, i) => (
            <li key={p.types.join('>')}>
              <button
                type="button"
                aria-pressed={trace.active === i}
                onClick={() => trace.setActive(i)}
                className={cn(
                  'relative flex w-full flex-col items-start gap-0.25 rounded-md px-1 py-0.5 text-left text-caption',
                  'text-mist outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring',
                  'hover:bg-accent/60 hover:text-bone aria-pressed:bg-accent aria-pressed:text-bone',
                  // non-colour cue for the drawn path
                  'aria-pressed:before:absolute aria-pressed:before:inset-y-0.5 aria-pressed:before:left-0 aria-pressed:before:w-0.25 aria-pressed:before:rounded-full aria-pressed:before:bg-bone',
                )}
              >
                <span className="text-pretty">{p.types.join(' → ')}</span>
                <span className="font-mono text-mist tabular-nums">
                  {percent(p.fraction)} · {t('trace.syn', { n: p.synapses })}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  );
});

/** A path end: free text, committed when it names a type of this circuit (Enter or blur). */
function EndField(p: {
  label: string;
  value: string | null;
  list: string;
  types: string[];
  onCommit(type: string | null): void;
}) {
  const [text, setText] = useState(p.value ?? '');
  const [seen, setSeen] = useState(p.value);
  // a click in the scene set this end: show it
  if (seen !== p.value) {
    setSeen(p.value);
    setText(p.value ?? '');
  }
  const commit = () => {
    const v = text.trim();
    if (v === '') p.onCommit(null);
    else if (p.types.includes(v)) p.onCommit(v);
    else setText(p.value ?? '');
  };
  return (
    <label className="grid grid-cols-[3.5rem_1fr] items-center gap-1 text-caption">
      <span className="text-mist">{p.label}</span>
      <input
        value={text}
        list={p.list}
        placeholder={t('trace.placeholder')}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          // picking from the datalist fires a change with the full name
          if (p.types.includes(e.target.value)) p.onCommit(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setText(p.value ?? '');
            e.currentTarget.blur();
            e.preventDefault();
          }
        }}
        className="h-5 min-w-0 rounded-md bg-input px-1 font-mono text-bone outline-none placeholder:text-ash focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}
