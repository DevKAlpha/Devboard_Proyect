/**
 * Appearance controller: the app is dark only; a board can wear a seasonal skin.
 *
 * `<html data-theme>` is the color base the tokens read (always "dark" except
 * for skins built on a light base), and `<html data-skin>` selects the skin's
 * own palette and decorations (design/skins.css). Seasonal skins have one
 * fixed look on purpose: no light or dark variant.
 */
import { create } from 'zustand';
import type { BoardSkin } from '@devbord/shared';

export type ThemeBase = 'light' | 'dark';

/** Skin catalog: name shown in the picker and the color base it is drawn on. */
export const SKINS: Record<BoardSkin, { title: string; base: ThemeBase }> = {
  default: { title: 'Devbord', base: 'dark' },
  halloween: { title: 'Halloween', base: 'dark' },
  christmas: { title: 'Navidad', base: 'light' },
};

const apply = (skin: BoardSkin) => {
  const root = document.documentElement;
  root.dataset.theme = SKINS[skin].base;
  if (skin === 'default') delete root.dataset.skin;
  else root.dataset.skin = skin;
};

interface ThemeState {
  skin: BoardSkin;
  /** Color base of the current skin (canvas views re-read their colors when it changes). */
  resolved: ThemeBase;
  /** Dresses the page in a board's skin; "default" goes back to the app's look. */
  setSkin: (skin: BoardSkin) => void;
}

export const useThemeController = create<ThemeState>((set) => ({
  skin: 'default',
  resolved: 'dark',
  setSkin: (skin) => {
    apply(skin);
    set({ skin, resolved: SKINS[skin].base });
  },
}));
