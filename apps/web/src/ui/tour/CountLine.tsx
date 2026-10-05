import { observer } from 'mobx-react-lite';
import { data } from '@/data/store';
import { num, plural } from '@/i18n';
import { tour } from '@/state/tour';

/** Tour step 1: how many of the fly's neurons take part in this run (mono number). Phones: top (captions' slot). */
export const CountLine = observer(function CountLine() {
  const meta = data.scenario ? data.get(`${data.scenario}-meta`, 'meta') : undefined;
  if (tour.state?.step !== 1 || !meta) return null;
  const n = num(meta.n);
  const [before, after] = plural('tour.see.count', meta.n).split(n);
  return (
    <p className="pointer-events-none absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-10 mx-auto max-w-[32rem] text-center text-body font-light text-balance text-mist md:top-auto md:bottom-28 transition-opacity duration-200 ease-out starting:opacity-0">
      {before}
      <span className="font-mono text-bone tabular-nums">{n}</span>
      {after}
    </p>
  );
});
