/**
 * Cursor controller: state for the pixel cursor (views/cursor/PixelCursor).
 *
 * The pixel cursor is always on (with a mouse): it is part of Devbord's identity.
 * - `dragging` + `hint`: set by the board while a card is dragged, so the
 *   cursor can switch to the "grabbing" sprite and show where the card will land.
 */
import { create } from 'zustand';

interface CursorState {
  dragging: boolean;
  /** Short text shown next to the cursor while dragging (destination column). */
  hint: string | null;
  /** Starts or updates a drag; `hint` replaces the current one. */
  drag: (hint: string | null) => void;
  endDrag: () => void;
}

export const useCursorController = create<CursorState>((set) => ({
  dragging: false,
  hint: null,
  drag: (hint) => set({ dragging: true, hint }),
  endDrag: () => set({ dragging: false, hint: null }),
}));
