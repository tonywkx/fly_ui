import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { type Key, t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import { tour } from '@/state/tour';
import { NARRATION_LINES, narrationAt } from './narrationTiming';

const LINES = Array.from({ length: NARRATION_LINES }, (_, i) => `tour.narr.${i + 1}` as Key);

/**
 * Tour step 0: lines over the assembling dust, one at a time; the last one holds until the intro is
 * done, then step 1. Re-renders only at line boundaries (timeouts), never per frame.
 */
export const Narration = observer(function Narration() {
  const on = tour.state?.step === 0;
  const ready = app.introPhase === 'done';
  const [line, setLine] = useState(0);
  const start = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!on) return;
    start.current ??= performance.now();
    const t0 = start.current;
    let id: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const now = performance.now() - t0;
      const s = narrationAt(now, ready);
      setLine(s.line);
      if (s.done) tour.next();
      else if (s.nextMs !== undefined) id = setTimeout(tick, s.nextMs - now);
    };
    tick();
    return () => clearTimeout(id);
  }, [on, ready]);

  if (!on) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-4 bottom-[28%] z-10 mx-auto grid max-w-[56rem] md:bottom-24 text-center text-balance"
    >
      {LINES.map((key, i) => (
        <p
          key={key}
          aria-hidden={i !== line}
          className={cn(
            '[grid-area:1/1] text-body leading-tight font-light tracking-[-0.02em] text-bone md:text-heading-sm md:tracking-[-0.04em]',
            'transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:translate-none',
            i === line ? 'opacity-100' : 'translate-y-1 opacity-0',
          )}
        >
          {t(key)}
        </p>
      ))}
    </div>
  );
});
