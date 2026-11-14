/** Design system barrel. Views import UI primitives from here only. */
export { Button, type ButtonProps } from './components/Button';
export { IconButton } from './components/IconButton';
export { PixelIcon, type IconName } from './components/PixelIcon';
export { PixelDuck } from './components/PixelDuck';
export { installSkinSprites } from './skinSprites';
export { SKIN_HAT, duckFaviconUri, hatRects, type DuckHat } from './duck';
export { Input, Textarea, Select, Field } from './components/Field';
export { Modal } from './components/Modal';
export { PixelScroll } from './components/PixelScroll';
export { Badge } from './components/Badge';
export { cx } from './cx';
export { ConfirmHost } from './components/ConfirmDialog';
export { confirm, type ConfirmOptions } from './confirm';
export {
  animateFlash,
  animateIn,
  animateLand,
  animateOut,
  animateShake,
  pixelBurst,
  type FlipPositions,
  animateStick,
  flip,
  initMotion,
  isMotionLite,
  setMotionLite,
} from './motion';
