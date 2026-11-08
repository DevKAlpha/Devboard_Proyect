import { PixelIcon } from '../../design';

/** Devbord wordmark: pixel board icon on an accent tile + pixel font. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink shadow-card">
        <PixelIcon name="board" />
      </span>
      <span className="font-pixel text-lg font-bold tracking-wide">Devbord</span>
    </span>
  );
}
