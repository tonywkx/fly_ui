import { when } from 'mobx';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { app } from './state/app';
import { Boot } from './ui/Boot';
import './ui/theme.css';

declare global {
  interface Window {
    /** Set when the requested state is fully rendered; read by scripts/snap.ts. */
    __snapReady?: boolean;
  }
}

for (const w of app.warnings) console.warn(`[params] ${w}`);

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
app.setReducedMotion(motion.matches);
motion.addEventListener('change', (e) => app.setReducedMotion(e.matches));

app.waitFor('fonts');
Promise.all(['400 16px "Inter Variable"', '400 12px "Geist Mono"'].map((f) => document.fonts.load(f)))
  .catch((e) => console.warn('[fonts]', e))
  .finally(() => app.markReady('fonts'));

app.waitFor('data');
app.waitFor('frame');
const dish = app.params.view === 'dish';
// dynamic: the manifest parser (zod) stays out of the entry; fetched beside the App chunk
import('./data/store')
  .then(({ data }) => (dish ? data.loadManifest() : data.loadFirstFrame(app.params.scenario)))
  .catch((e) => {
    console.error('[data]', e);
    app.markReady('frame'); // nothing will draw; let snap capture the broken state
  })
  .finally(() => app.markReady('data'));

// zoomed in from the dish: the visitor came to operate, not for the tour
if (!dish && app.params.from !== 'dish') void import('./ui/tour/boot').then((m) => m.bootTour());

when(
  () => app.ready,
  () => {
    window.__snapReady = true;
  },
);

// the scene and the whole UI (~1.7 MB) arrive under the boot paint; data loading above already started
const App = lazy(() => import('./App').then((m) => ({ default: m.App })));

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<Boot />}>
      <App />
    </Suspense>
  </StrictMode>,
);
