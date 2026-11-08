/** App entry point. Global styles (design tokens) are imported once here. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/tokens.css';
import { initMotion } from './design';
import { App } from './views/App';

// Decide the animation level before the first render (see design/motion.ts).
initMotion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
