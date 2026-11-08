import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { IconButton, PixelIcon, cx } from '../../design';
import { useBoardController } from '../../controllers/boardController';
import { useThemeController } from '../../controllers/themeController';
import { Logo } from './Logo';

/** Dot colors cycle per board so the sidebar list is scannable (like project dots in Linear/Mast). */
const DOT_COLORS = ['blue', 'purple', 'green', 'orange', 'red', 'yellow'] as const;

const navItem = ({ isActive }: { isActive: boolean }) =>
  cx(
    'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors',
    isActive
      ? 'border border-line-soft bg-surface font-medium text-ink shadow-card'
      : 'text-muted hover:bg-surface-3/60 hover:text-ink',
  );

function ThemeToggle() {
  const { resolved, toggle } = useThemeController();
  return (
    <IconButton
      icon={resolved === 'dark' ? 'sun' : 'moon'}
      label={resolved === 'dark' ? 'Tema claro' : 'Tema oscuro'}
      onClick={toggle}
    />
  );
}

/**
 * Application frame (from the mockup references): a calm sidebar with the
 * board list on desktop, a compact top bar on mobile, and the page content on
 * a raised canvas panel.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const boards = useBoardController((s) => s.boards);

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Mobile top bar. */}
      <header className="flex h-14 shrink-0 items-center justify-between px-4 md:hidden">
        <NavLink to="/" aria-label="Inicio">
          <Logo />
        </NavLink>
        <ThemeToggle />
      </header>

      <aside
        className="hidden w-60 shrink-0 flex-col gap-6 px-3 py-4 md:flex"
        aria-label="Navegación"
      >
        <NavLink to="/" className="px-2" aria-label="Inicio">
          <Logo />
        </NavLink>

        <nav className="flex flex-col gap-1">
          <NavLink to="/" end className={navItem}>
            <PixelIcon name="home" /> Tableros
          </NavLink>
        </nav>

        {boards.length > 0 && (
          <div className="flex min-h-0 flex-col gap-1">
            <p className="px-2.5 text-xs font-medium text-faint">Mis tableros</p>
            <nav className="-mx-1 flex flex-col gap-0.5 overflow-y-auto px-1" aria-label="Tableros">
              {boards.map((b, i) => (
                <NavLink key={b.id} to={`/b/${b.id}`} className={navItem}>
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{ background: `var(--label-${DOT_COLORS[i % DOT_COLORS.length]}-ink)` }}
                  />
                  <span className="truncate">{b.name}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between px-1">
          <span className="text-xs text-faint">Apariencia</span>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-line-soft bg-surface md:my-2 md:mr-2 md:rounded-2xl md:border md:shadow-card">
        {children}
      </div>
    </div>
  );
}
