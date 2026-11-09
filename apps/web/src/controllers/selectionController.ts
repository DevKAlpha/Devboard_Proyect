/**
 * Card multi-selection on the open board (view state, never saved).
 *
 * Cards subscribe to their own membership (`useIsSelected`), so changing the
 * selection only re-renders the cards that changed, not the whole board.
 */
import { create } from 'zustand';
import type { Board } from '@devbord/shared';

interface SelectionState {
  ids: ReadonlySet<string>;
  /** Last card clicked: the start of a Shift+click range. */
  anchor: string | null;
  toggle: (id: string) => void;
  /** Replaces the selection (or adds to it, keeping the current one). */
  set: (ids: Iterable<string>, add?: boolean) => void;
  clear: () => void;
}

const EMPTY: ReadonlySet<string> = new Set();

export const useSelection = create<SelectionState>((set, get) => ({
  ids: EMPTY,
  anchor: null,
  toggle: (id) => {
    const ids = new Set(get().ids);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    set({ ids, anchor: id });
  },
  set: (next, add = false) => {
    const ids = new Set(add ? get().ids : EMPTY);
    for (const id of next) ids.add(id);
    set({ ids });
  },
  clear: () => {
    if (get().ids.size || get().anchor) set({ ids: EMPTY, anchor: null });
  },
}));

/** True when the card is part of the selection. */
export const useIsSelected = (id: string) => useSelection((s) => s.ids.has(id));

/** Selected ids that still exist on the board, in board order. */
export const orderedSelection = (board: Board, ids: ReadonlySet<string>) =>
  board.columns.flatMap((c) => c.cards.filter((card) => ids.has(card.id)).map((card) => card.id));
