import type { ReactNode } from 'react';
import { IconButton } from '../../design';
import { useThemeController } from '../../controllers/themeController';
import { Logo } from './Logo';

/** Translucent, blurred top bar (the "Apple" touch) with the theme toggle. */
export function TopBar({ children }: { children?: ReactNode }) {
  const { resolved, toggle } = useThemeController();
  return (
    <header className="sticky top-0 z-20 border-b-2 border-line-soft bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
        <Logo />
        <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
        <IconButton
          icon={resolved === 'dark' ? 'sun' : 'moon'}
          label={resolved === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          onClick={toggle}
        />
      </div>
    </header>
  );
}
