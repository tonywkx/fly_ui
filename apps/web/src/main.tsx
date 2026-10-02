import { when } from 'mobx';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { app } from './state/app';
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
when(
  () => app.ready,
  () => {
    window.__snapReady = true;
  },
);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
