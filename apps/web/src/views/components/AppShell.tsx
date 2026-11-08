import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { IconButton, PixelIcon, cx } from '../../design';
import { useThemeController } from '../../controllers/themeController';
import { useCursorController } from '../../controllers/cursorController';
import { Logo } from './Logo';

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

/** Turns the pixel cursor on or off (some users prefer their system pointer). */
function CursorToggle() {
  const enabled = useCursorController((s) => s.enabled);
  const setEnabled = useCursorController((s) => s.setEnabled);
  return (
    <IconButton
      icon="cursor"
      label={enabled ? 'Usar cursor del sistema' : 'Usar cursor pixel'}
      aria-pressed={enabled}
      className={enabled ? 'text-accent' : undefined}
      onClick={() => setEnabled(!enabled)}
    />
  );
}

/**
 * Application frame: a slim translucent top bar (logo + appearance toggles)
 * above the page content. No sidebar on purpose: the board gets the full
 * width and nothing competes with it for attention.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="sticky top-0 z-20 shrink-0 border-b border-line-soft bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
          <NavLink to="/" aria-label="Devbord, ir al inicio">
            <Logo />
          </NavLink>
          {/* Explicit "Inicio": always takes the user back to the start screen (board list). */}
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cx(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-surface-3 text-ink'
                  : 'text-muted hover:bg-surface-3/70 hover:text-ink',
              )
            }
          >
            <PixelIcon name="home" /> Inicio
          </NavLink>
          <span className="flex-1" />
          <CursorToggle />
          <ThemeToggle />
        </div>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
