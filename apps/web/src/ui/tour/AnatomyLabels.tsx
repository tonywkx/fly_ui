import { observer } from 'mobx-react-lite';
import { useLayoutEffect, useRef } from 'react';
import { type Key, t } from '@/i18n';
import { anatomyDom, type Part } from '@/scene/anatomy';
import { tour } from '@/state/tour';

const PARTS: Part[] = ['optic', 'brain', 'vnc'];

/** Tour step 1: three labels beside the shells with leader lines; the scene positions them (`scene/anatomy`). */
export const AnatomyLabels = observer(function AnatomyLabels() {
  if (tour.state?.step !== 1) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-200 ease-out starting:opacity-0">
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {PARTS.map((part) => (
          <Line key={part} part={part} />
        ))}
      </svg>
      {PARTS.map((part) => (
        <Label key={part} part={part} />
      ))}
    </div>
  );
});

/** The line node, kept for its label to register. */
const lines = new Map<Part, SVGLineElement>();

function Line({ part }: { part: Part }) {
  return (
    <line
      ref={(el) => {
        if (el) lines.set(part, el);
        else lines.delete(part);
      }}
      className="stroke-ash"
      strokeWidth={1}
      style={{ visibility: 'hidden' }}
    />
  );
}

const Label = observer(function Label({ part }: { part: Part }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const label = ref.current;
    const line = lines.get(part);
    if (!label || !line) return;
    const dom = { label, line, size: { w: label.offsetWidth, h: label.offsetHeight } };
    // language / breakpoint (short names on phones) change the size; the frame loop never reads layout
    const ro = new ResizeObserver(() => {
      dom.size = { w: label.offsetWidth, h: label.offsetHeight };
    });
    ro.observe(label);
    anatomyDom.set(part, dom);
    return () => {
      ro.disconnect();
      anatomyDom.delete(part);
    };
  }, [part]);

  return (
    <p
      ref={ref}
      className="absolute top-0 left-0 text-label whitespace-nowrap text-mist [text-shadow:0_0_6px_var(--color-void),0_0_2px_var(--color-void)]"
      style={{ visibility: 'hidden' }}
    >
      <span className="hidden md:inline">{t(`tour.label.${part}` as Key)}</span>
      <span className="md:hidden">{t(`tour.label.${part}Short` as Key)}</span>
    </p>
  );
});
