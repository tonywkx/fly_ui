import { observer } from 'mobx-react-lite';
import { welcome } from '@/state/welcome';

/** Holds the inline first paint (`.boot-mark` in index.html) while the app chunk loads; the full welcome brings its own. */
export const Boot = observer(function Boot() {
  if (welcome.mode === 'full') return null;
  return (
    <p className="boot-mark" aria-hidden="true">
      fly_ui
    </p>
  );
});
