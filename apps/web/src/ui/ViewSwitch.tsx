import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import type { Tool } from '@/state/experiment';

/**
 * A view's address: the dish is the bare page, the brain `?view=brain`; a pinned language stays.
 * The zoom adds where it came `from`, the brain's scenario and the experiment code (`x`) it carries
 * (with `x` the dish names itself: alone, `x` is an old brain link), and the brain's tool in hand.
 */
export function viewHref(o: {
  dish: boolean;
  from?: 'dish' | 'brain';
  scenario?: string;
  x?: string;
  tool?: Tool;
}): string {
  const q = new URLSearchParams();
  if (!o.dish) q.set('view', 'brain');
  else if (o.x) q.set('view', 'dish');
  if (o.scenario) q.set('scenario', o.scenario);
  if (o.from) q.set('from', o.from);
  if (o.x) q.set('x', o.x);
  if (o.tool) q.set('tool', o.tool);
  if (app.params.lang) q.set('lang', app.lang);
  const s = q.toString();
  return s ? `?${s}` : window.location.pathname;
}

/**
 * The other view as one ghost link: «заглянуть в мозг» from the dish, «в террариум» from the brain.
 * `onPeek` takes the click when it can fly there (the dish's zoom into her head); else it navigates.
 */
export const ViewSwitch = observer(function ViewSwitch({
  onPeek,
  className,
}: {
  onPeek?: () => boolean;
  className?: string;
}) {
  const dish = app.params.view === 'dish';
  return (
    <Button
      variant="ghost"
      asChild
      className={cn(
        'pointer-events-auto h-8 px-2 text-caption text-ash hover:text-bone md:h-6 md:px-1',
        className,
      )}
    >
      <a
        href={viewHref({ dish: !dish })}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          if (onPeek?.()) e.preventDefault();
        }}
      >
        {t(dish ? 'view.peek' : 'view.home')}
      </a>
    </Button>
  );
});
