import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { BANDS, lanes as lanesOf } from '@/data/bands';
import { data } from '@/data/store';
import { t as tr } from '@/i18n';
import { app } from '@/state/app';
import { playback, playbackKey, SPEEDS } from '@/state/playback';
import { ACCENT, TEXT } from '@/ui/palette';
import { bandTop, paintCounts, type RasterGeom, rasterCounts, rasterHeight } from '@/ui/raster';
import { toggleSound } from '@/ui/Sound';

/** Band height and gap, CSS px. */
const BAND_PX = 14;
const GAP_PX = 3;
/** Live: sim ms shown (history is scrubbable within it); raster redraws at most this often (ms). */
const LIVE_WINDOW_MS = 400;
const LIVE_REDRAW_MS = 33;
/** Shade over the not-yet-shown part of the raster. */
const FUTURE_SHADE = 0.6;
/** Lane backing behind the spikes. */
const LANE_ALPHA = 0.05;
const SPEED_LABEL: Record<number, string> = { 1: '1×', 0.5: '½×', 0.25: '¼×', 0.125: '⅛×' };

/** Keys typed into a field are not hotkeys; Space on a button presses the button. */
const ownsKey = (t: EventTarget | null, key: string) =>
  t instanceof HTMLElement &&
  (t.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) ||
    (key === ' ' && t.tagName === 'BUTTON'));

/**
 * Spike raster by region (optic lobes → central brain → descending → VNC) with the playhead, play /
 * pause and slow-mo; drag on it to scrub. Baked: the whole loop, drawn once. Live: the last
 * `LIVE_WINDOW_MS`, redrawn as spikes arrive. Drawn in its own rAF from `playback.clock` (no React
 * renders per frame). Ends with the director camera toggle. Owns the playback hotkeys (Space , . [ ]), D and M.
 */
export const Timeline = observer(function Timeline() {
  const { log, mode, paused, speed } = playback;
  const meta = log && data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  const lanes = useMemo(() => (meta ? lanesOf(meta) : undefined), [meta]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || ownsKey(e.target, e.key)) return;
      if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'd') {
          app.toggleDirector();
          return;
        }
        if (e.key === 'm') {
          toggleSound();
          return;
        }
      }
      const a = playbackKey(e);
      if (!a) return;
      e.preventDefault();
      playback.run(a);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new log (live takes over) must restart the raster
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    const box = el?.parentElement;
    if (!el || !box || !ctx || !log || !lanes) return;
    const off = document.createElement('canvas');
    const offCtx = off.getContext('2d') as CanvasRenderingContext2D;
    let geom: RasterGeom = { w: 1, bandH: 1, gap: 1 };
    let drawn = { from: Number.NaN, to: Number.NaN, until: Number.NaN, at: 0 };
    let dragging: { from: number; to: number; wasPaused: boolean } | null = null;
    let shownMs = Number.NaN;

    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      geom = {
        w: Math.max(1, Math.round(box.clientWidth * dpr)),
        bandH: Math.round(BAND_PX * dpr),
        gap: Math.round(GAP_PX * dpr),
      };
      el.width = off.width = geom.w;
      el.height = off.height = rasterHeight(geom);
      drawn = { from: Number.NaN, to: Number.NaN, until: Number.NaN, at: 0 };
    };

    const paint = (from: number, to: number) => {
      const counts = rasterCounts(log, lanes, from, to, geom);
      let max = 0;
      for (const c of counts) if (c > max) max = c;
      const img = offCtx.createImageData(geom.w, rasterHeight(geom));
      paintCounts(counts, img, Math.max(2, max / 2));
      offCtx.putImageData(img, 0, 0);
    };

    /** Visible time range: the baked loop, or a live window that keeps the playhead in view. */
    const view = (): [number, number] => {
      const { t, start, end } = playback.clock;
      if (playback.mode === 'baked') return [0, Math.max(1, end)];
      if (dragging) return [dragging.from, dragging.to];
      const to = Math.max(start + LIVE_WINDOW_MS, t < end - LIVE_WINDOW_MS ? t + LIVE_WINDOW_MS / 4 : end);
      return [to - LIVE_WINDOW_MS, to];
    };

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const [from, to] = view();
      // live: new spikes arrive while the window stands still too
      const stale = from !== drawn.from || to !== drawn.to || log.until !== drawn.until;
      if (stale && (playback.mode === 'baked' || now - drawn.at >= LIVE_REDRAW_MS || dragging)) {
        paint(from, to);
        drawn = { from, to, until: log.until, at: now };
      }
      const { t } = playback.clock;
      const x = Math.round(((t - drawn.from) / (drawn.to - drawn.from)) * geom.w);
      ctx.clearRect(0, 0, el.width, el.height);
      // faint lanes: time without spikes (the baked tail, the live future) still reads as time
      ctx.globalAlpha = LANE_ALPHA;
      ctx.fillStyle = TEXT.bone;
      for (let b = 0; b < BANDS.length; b++) ctx.fillRect(0, bandTop(b, geom), el.width, geom.bandH);
      ctx.globalAlpha = 1;
      ctx.drawImage(off, 0, 0);
      // not shown yet: the rest of the baked run, or what the live sim has buffered ahead
      ctx.globalAlpha = FUTURE_SHADE;
      ctx.fillStyle = ACCENT.void;
      ctx.fillRect(x + 1, 0, el.width - x - 1, el.height);
      ctx.globalAlpha = 1;
      ctx.fillStyle = ACCENT.saffron;
      ctx.fillRect(
        Math.min(el.width - 1, Math.max(0, x)),
        0,
        Math.max(1, Math.round(window.devicePixelRatio || 1)),
        el.height,
      );
      const ms = Math.round(t * 10) / 10;
      if (ms !== shownMs) {
        shownMs = ms;
        if (readout.current) readout.current.textContent = ms.toFixed(1);
        el.setAttribute('aria-valuemin', String(Math.round(playback.clock.start)));
        el.setAttribute('aria-valuemax', String(Math.round(playback.clock.end)));
        el.setAttribute('aria-valuenow', String(Math.round(t)));
        el.setAttribute('aria-valuetext', tr('unit.ms', { v: ms.toFixed(1) }));
      }
    };

    const timeAt = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      return drawn.from + f * (drawn.to - drawn.from);
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      dragging = { from: drawn.from, to: drawn.to, wasPaused: playback.paused };
      playback.setPaused(true);
      playback.seek(timeAt(e));
    };
    const move = (e: PointerEvent) => {
      if (dragging) playback.seek(timeAt(e));
    };
    const up = () => {
      if (!dragging) return;
      playback.setPaused(dragging.wasPaused);
      dragging = null;
    };

    size();
    const ro = new ResizeObserver(size);
    ro.observe(box);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [log, lanes]);

  if (!log || !lanes) return null;

  const onSliderKey = (e: React.KeyboardEvent) => {
    const { t, start, end } = playback.clock;
    const big = e.shiftKey ? 10 : 1;
    let to: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = t - big;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = t + big;
    else if (e.key === 'Home') to = start;
    else if (e.key === 'End') to = end;
    if (to === null) return;
    e.preventDefault();
    playback.setPaused(true);
    playback.seek(to);
  };

  return (
    <section
      aria-label={tr('timeline.label')}
      className="pointer-events-auto flex w-[min(44rem,100%,100vw-30rem)] items-center gap-1.5 rounded-panel bg-card px-1 py-1 backdrop-blur-md"
    >
      <div className="flex shrink-0 flex-col items-center">
        <Button
          aria-label={tr(paused ? 'timeline.play' : 'timeline.pause')}
          aria-keyshortcuts="Space"
          onClick={() => playback.toggle()}
          className="size-6 rounded-full p-0 text-bone"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-2.5 fill-current">
            {paused ? <path d="M4 2.5v11l9.5-5.5z" /> : <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />}
          </svg>
        </Button>
        <Button
          aria-label={tr('timeline.speed', { v: SPEED_LABEL[speed] ?? '' })}
          aria-keyshortcuts="[ ]"
          title={tr('timeline.speedTitle')}
          onClick={() =>
            playback.setSpeed(SPEEDS[(SPEEDS.indexOf(speed as never) + 1) % SPEEDS.length] as number)
          }
          className="h-4 font-mono text-caption tabular-nums"
        >
          {SPEED_LABEL[speed]}
        </Button>
      </div>
      <ul
        aria-hidden
        className="flex shrink-0 flex-col text-caption"
        // lines up with the canvas bands
        style={{ gap: GAP_PX, lineHeight: `${BAND_PX}px` }}
      >
        {BANDS.map((b, i) => (
          <li key={b} className={lanes.counts[i] ? 'text-mist' : 'text-ash'}>
            {tr(`band.${b}`)}
          </li>
        ))}
      </ul>
      <div className="min-w-0 flex-1">
        <canvas
          ref={canvas}
          role="slider"
          tabIndex={0}
          aria-valuemin={Math.round(playback.clock.start)}
          aria-valuemax={Math.round(playback.clock.end)}
          aria-valuenow={Math.round(playback.clock.t)}
          aria-label={tr('timeline.simTime')}
          onKeyDown={onSliderKey}
          className="block w-full cursor-ew-resize touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ height: BANDS.length * BAND_PX + (BANDS.length - 1) * GAP_PX }}
        />
      </div>
      <p className="w-12 shrink-0 text-right font-mono text-caption tabular-nums">
        <span ref={readout} className="text-bone">
          0.0
        </span>{' '}
        <span className="text-ash">{tr('unit.msShort')}</span>
        {mode === 'live' && <span className="block text-mist">{tr('timeline.live')}</span>}
      </p>
      <Button
        aria-label={tr('follow.label')}
        aria-pressed={app.director}
        aria-keyshortcuts="D"
        title={tr('follow.title')}
        onClick={() => app.toggleDirector()}
        className="size-6 shrink-0 rounded-full p-0 aria-pressed:bg-accent aria-pressed:text-bone"
      >
        {/* viewfinder: four corners round a dot */}
        <svg viewBox="0 0 16 16" aria-hidden className="size-3 fill-none stroke-current" strokeWidth={1.5}>
          <path d="M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5" />
          <circle cx="8" cy="8" r="1.5" className="fill-current stroke-none" />
        </svg>
      </Button>
      <Button
        aria-label={tr('sound.label')}
        aria-pressed={app.sound}
        aria-keyshortcuts="M"
        title={tr('sound.title')}
        onClick={toggleSound}
        className="size-6 shrink-0 rounded-full p-0 aria-pressed:bg-accent aria-pressed:text-bone"
      >
        {/* speaker; waves when on */}
        <svg viewBox="0 0 16 16" aria-hidden className="size-3 fill-none stroke-current" strokeWidth={1.5}>
          <path d="M2 6h2.5L8 3v10L4.5 10H2z" className="fill-current stroke-none" />
          {app.sound ? <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5" /> : <path d="M11 6.5l3 3M14 6.5l-3 3" />}
        </svg>
      </Button>
    </section>
  );
});
