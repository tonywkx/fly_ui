import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { picksText } from './expText';
import { experimentCode } from './share';
import { viewHref } from './ViewSwitch';

/**
 * Zoomed in from the dish: the way back, top centre (where the dish keeps its timecode; the legend
 * owns the top-left). The link carries the experiment (`x`), so what the visitor silenced or drove
 * here is on in the fly when the dish flies out of her head. The pill counts it; with Silence in
 * hand (the card's «любой нейрон в мозге») the hint says what a click does.
 */
export const BackToDish = observer(function BackToDish() {
  if (app.params.from !== 'dish') return null;
  const n = { off: experiment.silenced.size, on: experiment.stimulated.size };
  const picking = experiment.tool === 'silence';
  return (
    <div className="pointer-events-none absolute top-4 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center rounded-xl bg-panel p-1 backdrop-blur md:top-8">
      <Button variant="ghost" asChild className="pointer-events-auto h-8 px-2 text-caption text-bone md:h-6">
        <a href={viewHref({ dish: true, from: 'brain', x: experimentCode() })}>
          {experiment.touched ? t('brain.back', { cells: picksText(n) }) : t('view.back')}
        </a>
      </Button>
      <p className={cn('px-2 pb-1 text-caption text-mist', !picking && 'hidden md:block')}>
        {t(picking ? 'brain.pickHint' : 'view.backHint')}
      </p>
    </div>
  );
});
