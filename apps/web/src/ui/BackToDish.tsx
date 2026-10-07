import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { app } from '@/state/app';
import { experimentCode } from './share';
import { viewHref } from './ViewSwitch';

/**
 * Zoomed in from the dish: the way back, top centre (where the dish keeps its timecode; the legend
 * owns the top-left). The link carries the experiment (`x`), so what the visitor silenced or drove
 * here is on in the fly when the dish flies out of her head.
 */
export const BackToDish = observer(function BackToDish() {
  if (app.params.from !== 'dish') return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex flex-col items-center md:top-8">
      <Button variant="ghost" asChild className="pointer-events-auto h-8 px-2 text-caption text-bone md:h-6">
        <a href={viewHref({ dish: true, from: 'brain', x: experimentCode() })}>{t('view.back')}</a>
      </Button>
      <p className="hidden px-2 text-caption text-ash md:block">{t('view.backHint')}</p>
    </div>
  );
});
