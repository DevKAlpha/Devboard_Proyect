/** App entry point. Global styles (design tokens) are imported once here. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/tokens.css';
import './design/skins.css';
import './design/pixel.css';
import { initMotion, installSkinSprites } from './design';
import { App } from './views/App';

// Decide the animation level before the first render (see design/motion.ts).
initMotion();
// Pixel sprites of the seasonal skins, as CSS variables (see design/skinSprites.ts).
installSkinSprites();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
