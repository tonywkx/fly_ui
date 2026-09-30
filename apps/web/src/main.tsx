import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './ui/theme.css';

declare global {
  interface Window {
    /** Set when the requested state is fully rendered; read by scripts/snap.ts. */
    __snapReady?: boolean;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
