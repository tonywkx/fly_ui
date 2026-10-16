import { observer } from 'mobx-react-lite';
import type { Ref } from 'react';
import { t } from '@/i18n';
import type { HoloLabel as Look } from '@/scene/dish/run';

/**
 * «Her brain · live» with a leader into the hologram (SURGEON-SHAPE §Hologram). The node sits at
 * the anchor; the frame loop moves and draws it (`paintLabel`). The leader rises from the anchor,
 * then turns out to the text.
 */
export const HoloLabel = observer(function HoloLabel({ ref }: { ref: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} hidden aria-hidden className="group pointer-events-none absolute top-0 left-0">
      <span className="absolute bottom-0 left-0 h-6 w-px origin-bottom bg-bone/40" />
      <span className="absolute bottom-6 h-px w-4 bg-bone/40 group-data-[side=left]:right-0 group-data-[side=left]:origin-right group-data-[side=right]:left-0 group-data-[side=right]:origin-left" />
      <span className="absolute bottom-6 translate-y-1/2 whitespace-nowrap text-caption text-mist text-shadow-halo group-data-[side=left]:right-5 group-data-[side=right]:left-5">
        {t('holo.label')}
      </span>
    </div>
  );
});

/** Writes the label's place and look (called from the frame loop: no React renders). */
export function paintLabel(el: HTMLDivElement | null, l: Look | null): void {
  if (!el) return;
  el.hidden = !l;
  if (!l) return;
  const [up, out, text] = el.children as unknown as [HTMLElement, HTMLElement, HTMLElement];
  if (el.dataset.side !== l.side) el.dataset.side = l.side;
  el.style.transform = `translate(${l.x}px, ${l.y}px)`;
  el.style.opacity = `${l.alpha}`;
  up.style.scale = `1 ${Math.min(1, l.leader * 2)}`;
  out.style.scale = `${Math.max(0, l.leader * 2 - 1)} 1`;
  text.style.opacity = `${l.text}`;
}
