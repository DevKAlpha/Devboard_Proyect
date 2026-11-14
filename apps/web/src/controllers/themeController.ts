/**
 * Appearance controller: light or dark mode, and the seasonal skin of a board.
 *
 * `<html data-theme>` is the color base the tokens read: the user's mode (top
 * bar switch, dark by default, remembered) for the app and the default skin,
 * or the skin's own base. `<html data-skin>` selects the skin's palette and
 * decorations (design/skins.css). Seasonal skins have one fixed look on
 * purpose: the mode switch does not apply to them. index.html applies the
 * stored mode before first paint, so there is no flash.
 */
import { create } from 'zustand';
import type { BoardSkin } from '@devbord/shared';
import { SKIN_HAT, duckFaviconUri } from '../design';

export type ThemeBase = 'light' | 'dark';

export interface SkinInfo {
  title: string;
  description: string;
  /** Color base the skin is drawn on. */
  base: ThemeBase;
  /** Colors for previews (pickers, board tiles): page, column, card, accent. */
  swatch: { bg: string; column: string; card: string; accent: string };
}

/** Skin catalog: what the pickers show and the color base each skin is drawn on. */
export const SKINS: Record<BoardSkin, SkinInfo> = {
  default: {
    title: 'Devbord',
    description: 'El aspecto de siempre: sobrio, claro u oscuro.',
    base: 'dark',
    swatch: { bg: '#161618', column: '#1c1c1f', card: '#2a2a2e', accent: '#7d7aff' },
  },
  halloween: {
    title: 'Halloween',
    description: 'Noche morada, murciélagos, telarañas y sombrero de bruja.',
    base: 'dark',
    swatch: { bg: '#1b0f2a', column: '#241536', card: '#3a2452', accent: '#ff7a1a' },
  },
  christmas: {
    title: 'Navidad',
    description: 'Nieve, luces de colores, bastones de caramelo y gorro rojo.',
    base: 'light',
    swatch: { bg: '#dcebf3', column: '#eef4ec', card: '#ffffff', accent: '#d62839' },
  },
};

export const THEME_STORAGE_KEY = 'devbord:theme';

const readMode = (): ThemeBase => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark'; // storage blocked (private mode): the default look
  }
};

/** Base actually drawn: seasonal skins keep their own, the default one follows the mode. */
const baseOf = (skin: BoardSkin, mode: ThemeBase): ThemeBase =>
  skin === 'default' ? mode : SKINS[skin].base;

/** The favicon duck dresses up for the skin too (default: the plain duck). */
const setFavicon = (skin: BoardSkin) => {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  // Remember the plain favicon (its URL depends on the deploy base) to go back to it.
  const plain = (link.dataset.plain ??= link.href);
  const hat = SKIN_HAT[skin];
  link.href = hat ? duckFaviconUri(hat) : plain;
};

const apply = (skin: BoardSkin, mode: ThemeBase) => {
  setFavicon(skin);
  const root = document.documentElement;
  root.dataset.theme = baseOf(skin, mode);
  if (skin === 'default') delete root.dataset.skin;
  else root.dataset.skin = skin;
};

interface ThemeState {
  skin: BoardSkin;
  /** The user's light/dark choice (applies outside seasonal skins). */
  mode: ThemeBase;
  /** Color base on screen now (canvas views re-read their colors when it changes). */
  resolved: ThemeBase;
  /** Dresses the page in a board's skin; "default" goes back to the app's look. */
  setSkin: (skin: BoardSkin) => void;
  /** Flips light and dark (the switch in the top bar), and remembers it. */
  toggleMode: () => void;
}

export const useThemeController = create<ThemeState>((set, get) => {
  const mode = readMode();
  return {
    skin: 'default',
    mode,
    resolved: mode,
    setSkin: (skin) => {
      apply(skin, get().mode);
      set({ skin, resolved: baseOf(skin, get().mode) });
    },
    toggleMode: () => {
      const next: ThemeBase = get().mode === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* non-fatal: the choice just won't persist */
      }
      apply(get().skin, next);
      set({ mode: next, resolved: baseOf(get().skin, next) });
    },
  };
});
