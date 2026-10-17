import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { data } from '@/data/store';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { picksText } from './expText';
import { experimentCode } from './share';
import { viewHref } from './ViewSwitch';

/** The way back carries the cells and the scenario they were picked in: they exist only there. */
function back(): string {
  const x = experimentCode();
  return viewHref({ dish: true, from: 'brain', x, scenario: x ? (data.scenario ?? undefined) : undefined });
}

/**
 * Zoomed in from the dish: the way back, top centre (where the dish keeps its timecode; the legend
 * owns the top-left). The link carries the experiment (`x`), so what the visitor silenced or drove
 * here is on in the fly when the dish flies out of her head. The pill counts it; with Silence in
 * hand (the card's «любой нейрон в мозге») the phone hint says what a click does.
 */
export const BackToDish = observer(function BackToDish() {
  if (app.params.from !== 'dish') return null;
  const n = { off: experiment.silenced.size, on: experiment.stimulated.size };
  const picking = experiment.tool === 'silence';
  return (
    // `w-max`: centred by translate, the box would otherwise shrink to half the screen and wrap the hint
    <div className="pointer-events-none absolute top-4 left-1/2 z-10 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center rounded-xl bg-panel p-1 text-center backdrop-blur md:top-8">
      <Button variant="ghost" asChild className="pointer-events-auto h-8 px-2 text-caption text-bone md:h-6">
        <a href={back()}>{experiment.touched ? t('brain.back', { cells: picksText(n) }) : t('view.back')}</a>
      </Button>
      {/* picking: a phone has no toolbar, so the pill says what a click does; on desktop the
          Silence tool's own hint does, and the pill keeps «stays off in the fly» */}
      <p className={cn('px-2 pb-1 text-caption text-mist', !picking && 'hidden md:block')}>
        {picking && <span className="md:hidden">{t('brain.pickHint')}</span>}
        <span className={cn(picking && 'hidden md:inline')}>{t('view.backHint')}</span>
      </p>
    </div>
  );
});
