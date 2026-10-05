import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { data } from '@/data/store';
import { cn } from '@/lib/utils';
import { QUALITY } from '@/scene/quality';
import { Stage } from '@/scene/Stage';
import { app } from '@/state/app';
import { experiment } from '@/state/experiment';
import { tour } from '@/state/tour';
import { Captions } from '@/ui/Captions';
import { CommandPalette } from '@/ui/CommandPalette';
import { Fatal } from '@/ui/Fatal';
import { FlyCam } from '@/ui/FlyCam';
import { Inspector } from '@/ui/Inspector';
import { LangSwitch } from '@/ui/LangSwitch';
import { Legend } from '@/ui/Legend';
import { NeuronTooltip } from '@/ui/NeuronTooltip';
import { Scopes } from '@/ui/Scopes';
import { Sound } from '@/ui/Sound';
import { Stats } from '@/ui/Stats';
import { Timeline } from '@/ui/Timeline';
import { Toolbar } from '@/ui/Toolbar';
import { AnatomyLabels } from '@/ui/tour/AnatomyLabels';
import { Narration } from '@/ui/tour/Narration';
import { TourCard } from '@/ui/tour/TourCard';
import { TourRestart, TourSkip } from '@/ui/tour/TourChrome';
import { ViewerBar } from '@/ui/ViewerBar';
import { scenarioTitle } from '@/ui/viewer';

export const App = observer(function App() {
  const { scenario, debug, stats } = app.params;
  const title = scenario && scenarioTitle(scenario, 'title');
  // nothing to drive: Fatal explains why
  const broken = app.rendererFailed || !!data.error;
  // the tour shows the scene alone until its cheat sheet
  const touring = tour.state !== null && tour.state.step < 4;

  return (
    <div
      className="relative h-full overflow-hidden"
      data-blur={QUALITY[app.quality].blur ? undefined : 'off'}
    >
      <Stage />
      <Fatal />
      <AnatomyLabels />
      <Narration />
      <TourSkip />
      <Captions />
      <NeuronTooltip />
      <Inspector />
      {!touring && <Legend />}
      <FlyCam />
      <Sound />
      <CommandPalette />
      {/* phone = viewer without tools (PRODUCT.md); above the attribution row */}
      {!broken && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-2 bottom-16 z-10 hidden flex-col items-center gap-1 md:flex',
            // the open Inspector takes the right column: until both fit, centre between it and the title
            experiment.selected !== null &&
              'min-[72rem]:right-64 min-[72rem]:left-40 min-[92rem]:right-2 min-[92rem]:left-2',
          )}
        >
          {/* the card holds the toolbar's slot; on the cheat sheet the HUD fades back in under it */}
          <TourCard />
          {!touring && (
            <div className="flex w-full flex-col items-center gap-1 transition-opacity duration-200 ease-out starting:opacity-0">
              <Toolbar />
              <Scopes />
              <Timeline />
            </div>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 md:p-8">
        <div className="flex flex-col items-end gap-1 font-mono text-caption tabular-nums">
          {stats && <Stats />}
          {debug && (
            <p>
              <span className="text-ash">debug</span> <span className="text-saffron">{debug}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-3">
          {/* phones: the tour card needs the room */}
          <div className={cn(tour.active && tour.state?.step !== 0 && 'hidden md:block')}>
            <h1 className="text-heading-sm leading-none font-normal tracking-[-0.04em] md:text-heading-lg">
              fly_ui
            </h1>
            {/* phones name the scenario in the ViewerBar */}
            {title && <p className="mt-2 hidden text-body font-extralight text-mist md:block">{title}</p>}
            {/* phones switch language in the ViewerBar */}
            <div className="-mx-1 mt-1 hidden items-center gap-1 md:flex">
              <LangSwitch />
              <TourRestart />
            </div>
          </div>
          {/* phones: the card stands in for the ViewerBar until the tour ends */}
          {!broken && (tour.active ? <TourCard phone className="md:hidden" /> : <ViewerBar />)}
          <p className="pointer-events-auto -mx-1 text-caption text-ash">
            <Button variant="ghost" asChild className="h-auto py-3 text-caption md:py-0">
              <a href="https://neuprint.janelia.org/" target="_blank" rel="noreferrer">
                male-cns v1.0 · Janelia FlyEM / neuPrint · CC BY 4.0
              </a>
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
});
