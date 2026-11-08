import { useNavigate } from 'react-router';
import { PixelIcon } from '../../design';
import { useBoardController } from '../../controllers/boardController';

const ALL_BOARDS = '__all__';

/** Same split as the home page: personal and team boards are listed apart. */
const GROUPS = [
  { mode: 'personal', label: 'Individuales' },
  { mode: 'team', label: 'De equipo' },
] as const;

/**
 * Board switcher shown on every board: jump to another board without going
 * back to the list. Built on a native <select> (transparent, layered over a
 * pixel chip), so keyboard, screen readers and mobile pickers work for free.
 */
export function BoardSwitcher({ currentId }: { currentId: string }) {
  const boards = useBoardController((s) => s.boards);
  const navigate = useNavigate();

  return (
    <span className="relative inline-flex h-6 w-fit items-center gap-1 rounded-md px-1.5 text-xs text-muted hover:bg-surface-3/70 hover:text-ink">
      <PixelIcon name="board" size={12} />
      Cambiar tablero
      <PixelIcon name="chevron" size={12} />
      <select
        aria-label="Cambiar de tablero"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={currentId}
        onChange={(e) => navigate(e.target.value === ALL_BOARDS ? '/' : `/b/${e.target.value}`)}
      >
        {GROUPS.map(({ mode, label }) => {
          const list = boards.filter((b) => b.mode === mode);
          return list.length ? (
            <optgroup key={mode} label={label}>
              {list.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
        <option value={ALL_BOARDS}>Ver todos los tableros…</option>
      </select>
    </span>
  );
}
