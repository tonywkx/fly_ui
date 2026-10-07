import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';

/** A view's address: the dish is `?view=dish`, the brain the bare page; a pinned language stays. */
function href(dish: boolean): string {
  const q = new URLSearchParams();
  if (dish) q.set('view', 'dish');
  if (app.params.lang) q.set('lang', app.lang);
  const s = q.toString();
  return s ? `?${s}` : window.location.pathname;
}

/**
 * «Мозг · Террариум»: two ghost words, the current one bone, the other ash (like Dala nav). The
 * view is chosen at boot (`main.tsx`), so switching is a plain navigation.
 */
export const ViewSwitch = observer(function ViewSwitch({ className }: { className?: string }) {
  const dish = app.params.view === 'dish';
  return (
    <nav aria-label={t('view.switch')} className={cn('pointer-events-auto flex items-center', className)}>
      {([false, true] as const).map((d, i) => (
        <span key={String(d)} className="flex items-center">
          {i > 0 && (
            <span aria-hidden className="px-0.5 text-caption text-ash">
              ·
            </span>
          )}
          <Button
            variant="ghost"
            asChild
            className="h-8 px-2 text-caption text-ash aria-[current=page]:text-bone md:h-6 md:px-1"
          >
            <a href={href(d)} aria-current={d === dish ? 'page' : undefined}>
              {t(d ? 'view.dish' : 'view.brain')}
            </a>
          </Button>
        </span>
      ))}
    </nav>
  );
});
