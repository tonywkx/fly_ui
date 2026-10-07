import type { ChunkEntry, Manifest } from '@fly/data';
import { reaction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { data } from '@/data/store';
import { type Key, num, t } from '@/i18n';
import { cn } from '@/lib/utils';
import type { BrainData } from '@/scene/dish/holo';
import { LEVELS } from '@/scene/dish/levels';
import type { DishRun, DishStatus } from '@/scene/dish/run';
import { scenarioFor } from '@/scene/dish/zoom';
import { QUALITY } from '@/scene/quality';
import { app } from '@/state/app';
import { dish } from '@/state/dish';
import { Credit } from './Credit';
import { DishCaption } from './DishCaption';
import { DishLevels } from './DishLevels';
import { DishOps } from './DishOps';
import { DishPalette } from './DishPalette';
import { DishWhy } from './DishWhy';
import { LangSwitch } from './LangSwitch';
import { ViewSwitch, viewHref } from './ViewSwitch';

function timecode(s: DishStatus): string {
  if (s.loading) return t('dish.loading');
  const word = s.paused ? t('dish.paused') : t(`dish.state.${s.flash ?? s.action}` as Key);
  return `${t('dish.timecode', { t: num(s.t / 1000, undefined, 3) })} · ${word}`;
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
    if (ops?.[0]) {
      dish.setOps(ops);
      dish.setOpen(ops[0]);
    }
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
        onDecision: (d, why) => dish.setDecision(d, why),
        onStatus: (s) => {
          const text = timecode(s);
          if (line.current && line.current.textContent !== text) line.current.textContent = text;
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
      // a puzzle (re)start: a fresh dish laid out for it
      const round = reaction(
        () => dish.round,
        () => {
          run.reset();
          for (const it of LEVELS[dish.level ?? -1]?.items ?? []) run.input.place(it.kind, it);
        },
      );
      const p = app.params;
      const first = dish.firstLevel(p.level, !!(items || ops || from || p.experiment));
      if (first !== null) {
        dish.startLevel(first);
        dish.setHint(p.hint ?? 0);
      }
      if (p.sheet) dish.setTab(p.sheet);
      const quality = reaction(
        () => app.quality,
        (q) => run.applyQuality(QUALITY[q]),
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
      // the «why?» card freezes the dish; snaps (`why=1`) open it on the last decision
      const hold = reaction(
        () => dish.whyOpen,
        (on) => run.hold(on),
      );
      const ask = reaction(
        () => dish.why,
        (w) => app.params.why && w && dish.setWhyOpen(true),
      );
      dispose = () => {
        round();
        quality();
        surgery();
        puppet();
        hold();
        ask();
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

  return (
    <>
      <div ref={host} className="absolute inset-0" role="img" aria-label={t('dish.label')} />
      {/* not positioned: the chrome still lays out against the page; it steps aside while the zoom flies */}
      <div
        inert={dish.zooming}
        className={cn('transition-opacity duration-300 ease-out', dish.zooming && 'opacity-0')}
      >
        <p
          ref={line}
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
        {run && <DishPalette input={run.input} />}
        {run && (
          <DishOps
            onClearBrain={() => {
              run.clearBrain();
              // a reload must not bring it back
              const q = new URLSearchParams(location.search);
              q.delete('x');
              history.replaceState(null, '', `?${q}`);
            }}
          />
        )}
        <DishLevels />
        <DishCaption />
        <DishWhy />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 md:flex-row md:items-end md:justify-between md:p-8">
          <div className="flex items-center justify-between md:block">
            <h1 className="text-heading-sm leading-none font-normal tracking-[-0.04em] md:text-heading-lg">
              fly_ui
            </h1>
            <div className="-mx-1 flex items-center gap-1 md:mt-1">
              <ViewSwitch />
              <LangSwitch />
            </div>
          </div>
          <Credit />
        </div>
      </div>
    </>
  );
});

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
