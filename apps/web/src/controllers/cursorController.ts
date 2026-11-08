/**
 * Cursor controller: state for the pixel cursor (views/cursor/PixelCursor).
 *
 * - `enabled`: user preference, persisted. Some people prefer the system
 *   cursor (accessibility tools, high-contrast pointers), so it can be turned off.
 * - `dragging` + `hint`: set by the board while a card is dragged, so the
 *   cursor can switch to the "grabbing" sprite and show where the card will land.
 */
import { create } from 'zustand';

export const CURSOR_STORAGE_KEY = 'devbord:cursor';

const readEnabled = (): boolean => {
  try {
    return localStorage.getItem(CURSOR_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
};

interface CursorState {
  enabled: boolean;
  dragging: boolean;
  /** Short text shown next to the cursor while dragging (destination column). */
  hint: string | null;
  setEnabled: (enabled: boolean) => void;
  /** Starts or updates a drag; `hint` replaces the current one. */
  drag: (hint: string | null) => void;
  endDrag: () => void;
}

export const useCursorController = create<CursorState>((set) => ({
  enabled: readEnabled(),
  dragging: false,
  hint: null,
  setEnabled: (enabled) => {
    try {
      localStorage.setItem(CURSOR_STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      /* non-fatal: the choice lasts for this session only */
    }
    set({ enabled });
  },
  drag: (hint) => set({ dragging: true, hint }),
  endDrag: () => set({ dragging: false, hint: null }),
}));
