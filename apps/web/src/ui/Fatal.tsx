import { observer } from 'mobx-react-lite';
import { Button } from '@/components/ui/button';
import { data } from '@/data/store';
import { t } from '@/i18n';
import { app } from '@/state/app';

/** Replaces a black screen when the renderer cannot start or the data does not load. */
export const Fatal = observer(function Fatal() {
  const [title, hint] = app.rendererFailed
    ? [t('fatal.renderer.title'), t('fatal.renderer.hint')]
    : data.error
      ? [t('fatal.data.title'), t('fatal.data.hint')]
      : [];
  if (!title) return null;
  return (
    <div
      role="alert"
      className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-4 text-center"
    >
      <p className="text-body font-light text-balance text-bone">{title}</p>
      <p className="max-w-[32rem] text-caption text-ash">{hint}</p>
      {!app.rendererFailed && (
        <Button
          variant="primary"
          onClick={() => window.location.reload()}
          className="pointer-events-auto mt-3"
        >
          {t('fatal.reload')}
        </Button>
      )}
    </div>
  );
});
