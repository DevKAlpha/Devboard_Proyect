/**
 * Theme controller: light / dark / system preference.
 *
 * The resolved theme is written to `<html data-theme>`, which the design
 * tokens read. index.html applies the stored theme before first paint, so
 * there is no flash of the wrong theme.
 */
import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'devbord:theme';

const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

const resolve = (pref: ThemePreference): 'light' | 'dark' =>
  pref === 'system' ? (media()?.matches ? 'dark' : 'light') : pref;

const apply = (pref: ThemePreference) => {
  document.documentElement.dataset.theme = resolve(pref);
};

const readStored = (): ThemePreference => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    // Storage can be blocked (private mode); fall back to the OS preference.
    return 'system';
  }
};

interface ThemeState {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  /** Cycles light and dark explicitly (the toggle in the top bar). */
  toggle: () => void;
  setPreference: (pref: ThemePreference) => void;
}

export const useThemeController = create<ThemeState>((set, get) => {
  const initial = readStored();

  // Keep "system" in sync when the OS theme changes.
  media()?.addEventListener?.('change', () => {
    if (get().preference === 'system') {
      apply('system');
      set({ resolved: resolve('system') });
    }
  });

  return {
    preference: initial,
    resolved: resolve(initial),
    toggle: () => get().setPreference(get().resolved === 'dark' ? 'light' : 'dark'),
    setPreference: (preference) => {
      try {
        if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
        else localStorage.setItem(THEME_STORAGE_KEY, preference);
      } catch {
        /* non-fatal: preference just won't persist */
      }
      apply(preference);
      set({ preference, resolved: resolve(preference) });
    },
  };
});
