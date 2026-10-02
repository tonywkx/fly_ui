import { LIF_DEFAULTS } from '@fly/sim';
import { Pane } from 'tweakpane';
import type { Tuning } from '@/sim/sim.worker';

export interface TuningHost {
  /** Restarts the live scenario at t = 0 with these params. */
  apply(t: Tuning): void;
  /** Measured sim ms per wall-clock s. */
  speed(): number;
}

const defaults = () => ({
  vThreshold: LIF_DEFAULTS.vThreshold as number,
  vReset: LIF_DEFAULTS.vReset as number,
  tauMembrane: LIF_DEFAULTS.tauMembrane as number,
  tauSyn: LIF_DEFAULTS.tauSyn as number,
  refractory: LIF_DEFAULTS.refractory as number,
  wSyn: LIF_DEFAULTS.wSyn as number,
  gain: 1,
  poissonRate: LIF_DEFAULTS.poissonRate as number,
});
type Values = ReturnType<typeof defaults>;

/** Only what differs from the defaults: the shape scenario configs take. */
function diff(v: Values): Tuning {
  const base = defaults();
  return Object.fromEntries(Object.entries(v).filter(([k, x]) => base[k as keyof Values] !== x));
}

/** Dev-only sim param panel (Tweakpane, top right); a released slider restarts the scenario. Returns dispose. */
export function mountTuning(host: TuningHost): () => void {
  const v = defaults();
  const mon = { speed: 0 };
  const pane = new Pane({ title: 'sim' });
  let muted = false;

  const lif = pane.addFolder({ title: 'LIF (mV, ms)' });
  lif.addBinding(v, 'vThreshold', { label: 'v thr', min: -52, max: -30, step: 0.5 });
  lif.addBinding(v, 'vReset', { label: 'v reset', min: -70, max: -45, step: 0.5 });
  lif.addBinding(v, 'tauMembrane', { label: 'τ mem', min: 2, max: 60, step: 1 });
  lif.addBinding(v, 'tauSyn', { label: 'τ syn', min: 0.5, max: 20, step: 0.5 });
  lif.addBinding(v, 'refractory', { label: 'refract', min: 0, max: 10, step: 0.1 });
  const syn = pane.addFolder({ title: 'synapses' });
  syn.addBinding(v, 'wSyn', { min: 0, max: 1, step: 0.005 });
  syn.addBinding(v, 'gain', { min: 0, max: 4, step: 0.05 });
  const stim = pane.addFolder({ title: 'stimulus' });
  stim.addBinding(v, 'poissonRate', { label: 'Hz', min: 0, max: 400, step: 5 });

  pane.addBinding(mon, 'speed', { label: 'sim ms/s', readonly: true, format: (x: number) => x.toFixed(0) });
  pane.addButton({ title: 'defaults' }).on('click', () => {
    Object.assign(v, defaults());
    muted = true; // refresh may emit change per binding
    pane.refresh();
    muted = false;
    host.apply({});
  });
  pane.addButton({ title: 'copy JSON' }).on('click', () => {
    const json = JSON.stringify(diff(v));
    console.info('[sim] tuning', json);
    navigator.clipboard?.writeText(json).catch(() => {});
  });

  // folders only: the readonly monitor on the root emits change on every poll
  for (const f of [lif, syn, stim])
    f.on('change', (ev) => {
      if (ev.last && !muted) host.apply(diff(v));
    });
  const timer = setInterval(() => {
    mon.speed = host.speed();
  }, 500);

  return () => {
    clearInterval(timer);
    pane.dispose();
  };
}
