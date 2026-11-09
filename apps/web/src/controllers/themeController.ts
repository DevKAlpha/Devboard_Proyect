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
    description: 'El aspecto de siempre: oscuro y sobrio.',
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
