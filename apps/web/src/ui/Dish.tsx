import type { ChunkEntry, Manifest } from '@fly/data';
import { reaction, when } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { data } from '@/data/store';
import { type Key, num, t } from '@/i18n';
import { useWide } from '@/lib/useWide';
import { cn } from '@/lib/utils';
import type { BrainData } from '@/scene/dish/holo';
import type { DishRun, DishStatus } from '@/scene/dish/run';
import type { TakeResult } from '@/scene/dish/take';
import { scenarioFor } from '@/scene/dish/zoom';
import { QUALITY } from '@/scene/quality';
import { app } from '@/state/app';
import { dish } from '@/state/dish';
import { onbMemory, onboarding, startOnb } from '@/state/onboarding';
import { trial } from '@/state/trial';
import { Credit } from './Credit';
import { DishCaption } from './DishCaption';
import { DishCard } from './DishCard';
import { OpsStatus } from './DishOps';
import { DishPalette } from './DishPalette';
import { LangSwitch } from './LangSwitch';
import { paintReplay, ReplayBar, type ReplayRefs } from './ReplayBar';
import { ViewSwitch, viewHref } from './ViewSwitch';

function timecode(s: DishStatus): string {
  if (s.loading) return t('dish.loading');
  if (s.replay) return t('exp.replay.title', { t: num(s.t / 1000, undefined, 3), slow: s.slow });
  const word = s.paused ? t('dish.paused') : t(`dish.state.${s.flash ?? s.action}` as Key);
  return `${t('dish.timecode', { t: num(s.t / 1000, undefined, 3), slow: s.slow })} · ${word}`;
}

/** The remove button sits this far (px) up-right of the hovered item's centre. */
const REMOVE_OFFSET = { x: 24, y: -30 };

/**
 * The Terrarium (`?view=dish`): the dish scene with its live brain, the timecode line, the palette
 * and the hovered item's remove button. The line and the button are written from the frame loop
 * straight into the DOM — no React renders per frame.
 */
export const Dish = observer(function Dish() {
  const { manifest } = data;
  const host = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const remove = useRef<HTMLButtonElement>(null);
  const hovered = useRef<number | null>(null);
  const [run, setRun] = useState<DishRun | null>(null);
  const chrome = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const bar = useRef<ReplayRefs>({ range: null, play: null });
  const wide = useWide();

  // the dish centres in the band the chrome leaves: phone, under the strip and over the sheet
  // (it grows per tab); desktop, between the palette and the experiment card
  useEffect(() => {
    const el = host.current;
    const box = chrome.current;
    const bottom = foot.current;
    if (!run || !el || !box || !bottom) return;
    const wide = matchMedia('(width >= 48rem)');
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        if (wide.matches) {
          const edge = (sel: string) => box.querySelector<HTMLElement>(sel)?.getBoundingClientRect();
          const left = edge('[data-band-left]');
          const right = edge('[data-band-right]');
          return run.frameBand({
            top: 0,
            bottom: 0,
            left: left ? left.right - r.left : 0,
            right: right ? r.right - right.left : 0,
          });
        }
        let top = r.top;
        for (const t of box.querySelectorAll<HTMLElement>('[data-band-top]'))
          if (t.offsetParent) top = Math.max(top, t.getBoundingClientRect().bottom);
        box.style.setProperty('--band-top', `${Math.round(top - r.top)}px`);
        run.frameBand({
          top: top - r.top + CAPTION_SLOT,
          bottom: r.bottom - bottom.getBoundingClientRect().top,
          left: 0,
          right: 0,
        });
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(bottom);
    // desktop columns: the palette widens with the language and the reset button
    for (const c of box.querySelectorAll('[data-band-left], [data-band-right]')) ro.observe(c);
    wide.addEventListener('change', measure);
    // the card changes its width with the language and its content with the phase
    const card = reaction(() => [trial.phase, app.lang], measure, { fireImmediately: true });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wide.removeEventListener('change', measure);
      card();
    };
  }, [run]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the manifest arriving starts the dish
  useEffect(() => {
    const el = host.current;
    if (!el || !manifest) return;
    const chunk = (id: string) => manifest.chunks.find((c) => c.id === id);
    const graph = chunk('graph-full');
    const meta = chunk('meta-full');
    if (!graph || !meta) {
      console.error('[dish] graph-full / meta-full missing from the manifest');
      app.markReady('frame');
      return;
    }
    const { snap, t: until, items, ops, gl, from, zoom } = app.params;
    const arriving = from === 'brain';
    // black until the flight out of the head: no chrome over the void
    if (arriving) dish.setZooming(true);
    // first visit: the card walks through one experiment (phone: the sheet's «Опыт»)
    if (!arriving)
      onboarding.begin(
        startOnb({
          params: app.params,
          done: onbMemory.done(),
          journal: Object.keys(trial.pairs).length > 0,
        }),
      );
    if (app.params.exp) trial.repeat(`${app.params.exp.stim}:${app.params.exp.op}`);
    else if (ops?.[0]) {
      trial.setOp(ops[0]);
      dish.setOpen(ops[0]);
    }
    if (app.params.tab) trial.setTab(app.params.tab);
    if (snap) {
      app.waitFor('sim');
      app.waitFor('holo');
    }
    let disposed = false;
    let dispose = () => {};
    void import('@/scene/dish/run').then(({ DishRun }) => {
      if (disposed) return;
      const run = new DishRun(el, {
        forceWebGL: gl === 'webgl2',
        reducedMotion: app.reducedMotion,
        graphUrl: data.url(graph),
        metaUrl: data.url(meta),
        until: snap ? (until ?? 0) : undefined,
        arriving,
        experiment: app.params.experiment,
        onBrain: (n) => dish.setBrain(n),
        onReady: () => app.markReady('sim'),
        onZoom: (on) => dish.setZooming(on),
        // the black seam: the page becomes the brain view on the circuit of her last decision
        onDive: () =>
          location.assign(
            viewHref({ dish: false, from: 'dish', scenario: scenarioFor(dish.decision?.action ?? null) }),
          ),
        onCells: (n) => dish.setCells(n),
        onVerdict: (op, o) => dish.setNow(op, o),
        onDecision: (d) => dish.setDecision(d),
        onRecorded: (r) => dish.setRecorded(r),
        onStatus: (s) => {
          const text = timecode(s);
          if (line.current && line.current.textContent !== text) line.current.textContent = text;
          if (progress.current) progress.current.style.scale = `${s.trial ?? 0} 1`;
          if (s.replay) paintReplay(bar.current, s.replay);
          const b = remove.current;
          hovered.current = s.hover?.id ?? null;
          if (!b) return;
          b.hidden = !s.hover;
          if (s.hover)
            b.style.transform = `translate(${s.hover.x + REMOVE_OFFSET.x}px, ${s.hover.y + REMOVE_OFFSET.y}px) translate(-50%, -50%)`;
        },
      });
      for (const it of items ?? []) run.input.place(it.kind, it);
      setRun(run);
      // an experiment run: a clean take, hands let go (EXPERIMENT-SHAPE §Loop)
      const runs = reaction(
        () => trial.run,
        () => {
          const stim = trial.stim;
          if (!stim) return;
          dish.putDown();
          dish.setPulls();
          const done = (r: TakeResult) => {
            trial.finish(r);
            // snaps: the replay paused at `replay=` ms
            if (app.params.replay !== undefined) trial.replay();
          };
          if (!run.trial(stim, done)) trial.stop();
        },
      );
      const stops = reaction(
        () => trial.phase,
        (ph, was) => was === 'running' && ph === 'setup' && run.stopTrial(),
      );
      const p = app.params;
      // snaps: run the `?exp=` pair as soon as the live brain is up
      const auto = p.run
        ? when(
            () => dish.cells !== null,
            () => trial.start(true),
          )
        : () => {};
      if (p.sheet) dish.setPut(true);
      const quality = reaction(
        () => app.quality,
        (q) => run.applyQuality(QUALITY[q]),
      );
      // the card's op is live state: free play uses it too
      const slot = reaction(
        () => trial.op,
        (op) => dish.setOps(op === 'none' ? [] : [op]),
        { fireImmediately: true },
      );
      const surgery = reaction(
        () => [...dish.ops],
        (on) => run.setOps(on),
        { fireImmediately: true },
      );
      // puppet mode: arrows held (snaps hold them by `puppet=`)
      if (p.puppet) dish.setPulls(p.puppet);
      const puppet = reaction(
        () => [...dish.pulls],
        (keys) => run.setPulls(keys),
        { fireImmediately: true },
      );
      // the replay holds the live dish; nothing recorded = nothing to open
      const replay = reaction(
        () => trial.replaying,
        (on) => run.replay(on, app.params.replay) || trial.closeReplay(),
      );
      dispose = () => {
        runs();
        stops();
        auto();
        slot();
        quality();
        surgery();
        puppet();
        replay();
        run.dispose();
        setRun(null);
      };
      run
        .start()
        .then((backend) => {
          app.setBackend(backend);
          run.applyQuality(QUALITY[app.quality]);
          app.markReady('frame');
          return loadBrain(manifest);
        })
        .then((brain) => {
          if (disposed) return;
          if (brain) run.setBrain(brain);
          // back from the brain: fly out of the head once the hologram is there to fly out of
          if (arriving) run.arrive(zoom);
          else if (zoom !== undefined) run.dive(zoom);
          app.markReady('holo');
        })
        .catch((e) => {
          console.error('[dish] renderer failed', e);
          app.setRendererFailed();
        });
    });
    return () => {
      disposed = true;
      dispose();
    };
  }, [manifest]);

  useEffect(() => onboarding.attach(), []);

  // «заглянуть в мозг»: the fly zoom (8.9); a click mid-run / mid-flight is swallowed (no reload);
  // before the scene is up the link navigates
  const peek = () => {
    if (!run) return false;
    if (!run.zooming && trial.phase !== 'running' && !trial.replaying) run.dive();
    return true;
  };

  const clearBrain = () => {
    run?.clearBrain();
    // a reload must not bring it back
    const q = new URLSearchParams(location.search);
    q.delete('x');
    history.replaceState(null, '', `?${q}`);
  };

  return (
    <>
      <div ref={host} className="absolute inset-0" role="img" aria-label={t('dish.label')} />
      {/* not positioned: the chrome still lays out against the page; it steps aside while the zoom flies */}
      <div
        ref={chrome}
        inert={dish.zooming}
        className={cn('transition-opacity duration-300 ease-out', dish.zooming && 'opacity-0')}
      >
        <p
          ref={line}
          data-band-top
          aria-live="off"
          className="pointer-events-none absolute inset-x-0 top-6 text-center font-mono text-caption text-mist tabular-nums md:top-10"
        />
        <Button
          ref={remove}
          hidden
          aria-label={t('dish.remove')}
          className="absolute top-0 left-0 z-10 size-8 rounded-full bg-panel font-mono text-label text-mist backdrop-blur hover:text-bone"
          onClick={() => {
            if (hovered.current !== null) run?.input.remove(hovered.current);
          }}
        >
          ×
        </Button>
        {run && !trial.replaying && <DishPalette input={run.input} />}
        {wide && <DishCard progress={progress} onClearBrain={clearBrain} />}
        <OpsStatus />
        <DishCaption />
        <div
          ref={foot}
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 md:flex-row md:items-end md:justify-between md:p-8"
        >
          {run && trial.replaying && <ReplayBar run={run} bar={bar} />}
          {/* phones: the card is the sheet, «Положить» its middle tab */}
          {!wide && run && <DishCard progress={progress} input={run.input} onClearBrain={clearBrain} />}
          <div className="flex items-center justify-between md:block">
            <h1 className="text-heading-sm leading-none font-normal tracking-[-0.04em] md:text-heading-lg">
              fly_ui
            </h1>
            <div className="-mx-1 flex items-center gap-1 md:mt-1">
              <ViewSwitch onPeek={peek} />
              <LangSwitch />
              <OnbRestart />
            </div>
          </div>
          <Credit />
        </div>
      </div>
    </>
  );
});

/** «?»: the first-visit steps again (desktop: they live in the card). */
const OnbRestart = observer(function OnbRestart() {
  const label = t('onb.again');
  return (
    <Button
      aria-label={label}
      title={label}
      disabled={trial.phase === 'running' || trial.replaying || onboarding.step === 1}
      onClick={() => onboarding.restart()}
      className="pointer-events-auto hidden h-6 w-6 rounded-full font-mono text-caption md:inline-flex"
    >
      ?
    </Button>
  );
});

/** Phone: px kept under the top chrome for the decision caption. */
const CAPTION_SLOT = 56;

/** The hologram's chunks (dust sample, shells, neuropil centres), fetched after the first frame. */
async function loadBrain(m: Manifest): Promise<BrainData | null> {
  const ids = { cloud: 'cloud-lod0', shells: 'neuropil-shells', regions: 'neuropil-regions' } as const;
  const chunks = Object.values(ids).map((id) => m.chunks.find((c) => c.id === id));
  if (chunks.some((c) => !c)) {
    console.error('[dish] hologram chunks missing from the manifest');
    return null;
  }
  try {
    await Promise.all(chunks.map((c) => data.loadChunk(c as ChunkEntry)));
  } catch (e) {
    console.error('[dish] hologram failed', e);
    return null;
  }
  const cloud = data.get(ids.cloud, 'cloud');
  const shells = data.get(ids.shells, 'neuropil');
  const regions = data.get(ids.regions, 'neuropil');
  return cloud && shells && regions ? { cloud, shells, regions, bbox: m.bbox } : null;
}
