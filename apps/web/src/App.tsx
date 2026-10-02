import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { app } from '@/state/app';
import { Stats } from '@/ui/Stats';

const SCENARIO_TITLES: Record<string, string> = {
  escape: 'Escape',
  sugar: 'Sugar',
  song: 'Courtship song',
};

export const App = observer(function App() {
  const { scenario, debug, stats } = app.params;
  const title = scenario && (SCENARIO_TITLES[scenario] ?? scenario);

  return (
    <div className="relative h-full overflow-hidden">
      {/* Scene mount point (2.2): the renderer owns this node, React never touches its children. */}
      <div id="stage" className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 md:p-8">
        <div className="flex flex-col items-end gap-1 font-mono text-caption tabular-nums">
          {stats && <Stats />}
          {debug && (
            <p>
              <span className="text-ash">debug</span> <span className="text-saffron">{debug}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-heading-sm leading-none font-normal tracking-[-0.04em] md:text-heading-lg">
              fly_ui
            </h1>
            {title && <p className="mt-2 text-body font-extralight text-mist">{title}</p>}
          </div>
          <p className="pointer-events-auto -mx-1 text-caption text-ash">
            <Button variant="ghost" asChild className="h-auto text-caption">
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
