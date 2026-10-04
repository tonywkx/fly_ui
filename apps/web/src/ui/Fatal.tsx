import { observer } from 'mobx-react-lite';
import { data } from '@/data/store';
import { app } from '@/state/app';

/** Replaces a black screen when the renderer cannot start or the data does not load. */
export const Fatal = observer(function Fatal() {
  const [title, hint] = app.rendererFailed
    ? [
        'This browser can’t draw the scene',
        'It needs WebGPU or WebGL2: try a recent Chrome, Safari or Firefox.',
      ]
    : data.error
      ? ['The connectome didn’t load', 'Check the connection and reload the page.']
      : [];
  if (!title) return null;
  return (
    <div
      role="alert"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-4 text-center"
    >
      <p className="text-body font-light text-bone">{title}</p>
      <p className="max-w-[32rem] text-caption text-ash">{hint}</p>
    </div>
  );
});
