import { PixelDuck } from '../../design';

/**
 * Devbord wordmark: the pixel rubber duck (rubber duck debugging: explain the
 * problem to the duck and the answer shows up) on a soft tile + pixel font.
 */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <span className="grid size-7 place-items-center rounded-lg bg-accent-soft shadow-card">
        <PixelDuck size={22} />
      </span>
      <span className="font-pixel text-lg font-bold tracking-wide">Devbord</span>
    </span>
  );
}
