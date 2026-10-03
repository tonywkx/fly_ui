import { type NeuronRecord, neuronAt } from '@fly/data';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { data } from '@/data/store';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import { NT_COLORS } from '@/ui/palette';

/** Offset from the pointer (px); flips to the other side near the viewport edge. */
const OFFSET_X = 16;
const OFFSET_Y = 20;
const EDGE = 8;

const words = (s: string | null) => s?.replaceAll('_', ' ') ?? null;

/**
 * Hovered neuron next to the pointer. Content follows `app.hover` (changes rarely); the position is
 * written imperatively on pointermove — no React render per move.
 */
export const NeuronTooltip = observer(function NeuronTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const meta = data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  const row = app.hover;
  const shown = row !== null && !!meta && row < meta.n;
  // keep the last neuron while fading out
  const last = useRef<NeuronRecord | null>(null);
  if (shown) last.current = neuronAt(meta, row);
  const n = last.current;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = (x: number, y: number) => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = x + OFFSET_X + w + EDGE > window.innerWidth ? x - OFFSET_X - w : x + OFFSET_X;
      const top = y + OFFSET_Y + h + EDGE > window.innerHeight ? y - OFFSET_Y - h : y + OFFSET_Y;
      el.style.translate = `${Math.max(EDGE, left)}px ${Math.max(EDGE, top)}px`;
    };
    const { pick } = app.params;
    if (pick) place(pick[0] * window.innerWidth, pick[1] * window.innerHeight);
    const move = (e: PointerEvent) => place(e.clientX, e.clientY);
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  const cls = [words(n?.superclass ?? null), words(n?.class ?? null)].filter(Boolean).join(' · ');
  return (
    <div
      ref={ref}
      // off-screen until the first pointermove places it
      style={{ translate: '-9999px 0' }}
      aria-hidden={!shown}
      className={cn(
        'pointer-events-none fixed top-0 left-0 z-20 max-w-40 rounded-lg bg-popover px-2 py-2 text-popover-foreground backdrop-blur-md',
        'transition-opacity duration-100 ease-out motion-reduce:transition-none',
        // snaps are taken right after the pick: no mid-fade frames
        app.params.snap && 'transition-none',
        shown ? 'opacity-100' : 'opacity-0',
      )}
    >
      {n && (
        <>
          <p className="text-label leading-tight font-normal text-bone">{n.type ?? 'untyped'}</p>
          <p className="font-mono text-caption text-ash tabular-nums">{n.bodyId}</p>
          <div className="mt-2 flex flex-col text-caption text-mist">
            <p className="flex items-center gap-1 whitespace-nowrap">
              <span
                aria-hidden
                className="size-1 shrink-0 rounded-full"
                style={{ background: NT_COLORS[n.nt ?? 'unclear'].hex }}
              />
              {n.nt ?? 'unknown transmitter'}
              {n.ntConf !== null && (
                <span className="font-mono text-ash tabular-nums">{Math.round(n.ntConf * 100)}% pred.</span>
              )}
            </p>
            {cls && <p>{cls}</p>}
            {n.region && <p>{n.region}</p>}
          </div>
        </>
      )}
    </div>
  );
});
