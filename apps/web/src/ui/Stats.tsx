import { observer } from 'mobx-react-lite';
import { type RefObject, useEffect, useRef } from 'react';
import { onFrameSample } from '@/scene/frameStats';
import { app } from '@/state/app';

/** fps / render-ms from the engine's frame loop. Writes textContent; no React state per sample. */
export const Stats = observer(function Stats() {
  const fps = useRef<HTMLSpanElement>(null);
  const ms = useRef<HTMLSpanElement>(null);

  useEffect(
    () =>
      onFrameSample((s) => {
        if (fps.current) fps.current.textContent = String(Math.round(s.fps));
        if (ms.current) ms.current.textContent = s.ms.toFixed(1);
      }),
    [],
  );

  return (
    <p className="flex gap-2">
      <Readout label="fps" value={fps} />
      <Readout label="ms" value={ms} />
      <span className="text-ash">{app.backend ?? '—'}</span>
    </p>
  );
});

function Readout({ label, value }: { label: string; value: RefObject<HTMLSpanElement | null> }) {
  return (
    <span>
      <span ref={value} className="inline-block min-w-[4ch] text-right text-bone">
        —
      </span>{' '}
      <span className="text-ash">{label}</span>
    </span>
  );
}
