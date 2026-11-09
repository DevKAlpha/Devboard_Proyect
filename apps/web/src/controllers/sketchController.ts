/**
 * Whiteboard ("pizarra") controller: which board's whiteboard is open, the
 * chosen tool, and the live SketchModel the views draw from.
 *
 * Where the whiteboards live:
 *  - Personal board: its own local document (models/sketch openLocalSketch),
 *    with a list of whiteboards (SketchBook). You can keep several and switch
 *    between them like between boards; the last one used reopens next time.
 *  - Team board: one whiteboard inside the collaboration document of the live
 *    session, so everybody draws on the same sheet at the same time. There is
 *    no switching there on purpose: nobody ends up on a different whiteboard
 *    than the person explaining. If the session is not ready yet, the model
 *    attaches as soon as it is.
 *
 * Yjs and the model load on first open (dynamic import), never at startup.
 */
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import type { SketchBook } from '../models/sketch/SketchBook';
import type { SketchModel, SketchSnapshot } from '../models/sketch/SketchModel';
import {
  MAIN_SHEET,
  type InkColor,
  type NoteColor,
  type SheetInfo,
  type StrokeTool,
} from '../models/sketch/types';
import { useCollab } from './collabController';

export * from '../models/sketch/types';
export type { SketchModel } from '../models/sketch/SketchModel';

/**
 * Everything the toolbar can pick: drawing tools plus note, text, eraser and
 * the laser pointer (points at things without leaving ink).
 */
export type SketchTool = StrokeTool | 'note' | 'text' | 'eraser' | 'laser';

/** Width presets per size step (sheet units). The marker paints 3× wider. */
export const SIZE_STEPS = [3, 6, 12] as const;

const loadSketch = () => import('../models/sketch');
type SketchModule = Awaited<ReturnType<typeof loadSketch>>;

/** Remembers the last whiteboard used per board (a per-browser convenience). */
const lastSheetKey = (boardId: string) => `devbord:sketch:last:${boardId}`;
const readLastSheet = (boardId: string) => {
  try {
    return localStorage.getItem(lastSheetKey(boardId));
  } catch {
    return null; // storage blocked: start on the first whiteboard
  }
};
const writeLastSheet = (boardId: string, sheetId: string) => {
  try {
    localStorage.setItem(lastSheetKey(boardId), sheetId);
  } catch {
    /* storage blocked: nothing to remember */
  }
};

interface SketchState {
  open: boolean;
  /** Fills the window instead of floating over the board. */
  expanded: boolean;
  boardId: string | null;
  /** The whiteboard list (personal boards only; null on team boards). */
  book: SketchBook | null;
  sheetId: string;
  model: SketchModel | null;
  tool: SketchTool;
  color: InkColor;
  sizeStep: 0 | 1 | 2;
  noteColor: NoteColor;

  show: (boardId: string, team: boolean) => void;
  hide: () => void;
  toggleExpanded: () => void;
  /** Switches to another whiteboard of the open personal board. */
  selectSheet: (sheetId: string) => void;
  /** Creates a whiteboard and switches to it. */
  addSheet: () => void;
  renameSheet: (sheetId: string, name: string) => void;
  /** Deletes a whiteboard (never the last one). */
  removeSheet: (sheetId: string) => void;
  setTool: (tool: SketchTool) => void;
  setColor: (color: InkColor) => void;
  setSizeStep: (step: 0 | 1 | 2) => void;
  setNoteColor: (color: NoteColor) => void;
  /** Deletes the stored whiteboards of a personal board. */
  forget: (boardId: string) => Promise<void>;
}

/** Releases the current model and document. */
let release: (() => void) | null = null;
/** Bumped on every show/hide: a slow load that lost the race is dropped. */
let generation = 0;
/** The loaded module, to open other whiteboards of the same document synchronously. */
let sketchModule: SketchModule | null = null;

export const useSketch = create<SketchState>((set, get) => {
  const detach = () => {
    generation++;
    release?.();
    release = null;
    set({ model: null, book: null, sheetId: MAIN_SHEET });
  };

  /** Swaps the model to another whiteboard of the same personal document. */
  const openSheet = (book: SketchBook, sheetId: string) => {
    if (!sketchModule) return;
    const known = book.getSheets();
    const target = known.some((s) => s.id === sheetId) ? sheetId : known[0]!.id;
    const current = get().model;
    if (current && current.sheetId === target && current.doc === book.doc) return;
    current?.destroy();
    set({ sheetId: target, model: sketchModule.sketchOnDoc(book.doc, target) });
    const boardId = get().boardId;
    if (boardId) writeLastSheet(boardId, target);
  };

  const attachLocal = async (boardId: string, mine: number) => {
    sketchModule = await loadSketch();
    const local = await sketchModule.openLocalSketch(boardId);
    if (mine !== generation) return local.close();
    const { book } = local;
    set({ book });
    openSheet(book, readLastSheet(boardId) ?? MAIN_SHEET);
    // The open whiteboard was deleted: fall back to the first one.
    const unsubscribe = book.subscribe(() => openSheet(book, get().sheetId));
    release = () => {
      unsubscribe();
      get().model?.destroy();
      local.close();
    };
  };

  /** Follows the team session: attach when its doc appears, drop it when it goes. */
  const attachTeam = (boardId: string, mine: number) => {
    let model: SketchModel | null = null;
    const sync = async () => {
      const { doc, boardId: liveId } = useCollab.getState();
      const wanted = doc && liveId === boardId ? doc : null;
      if (model && model.doc === wanted) return;
      model?.destroy();
      model = null;
      set({ model: null });
      if (!wanted) return;
      sketchModule = await loadSketch();
      if (mine !== generation || useCollab.getState().doc !== wanted) return;
      model = sketchModule.sketchOnDoc(wanted, MAIN_SHEET);
      set({ model });
    };
    const unsubscribe = useCollab.subscribe((s, prev) => s.doc !== prev.doc && void sync());
    void sync();
    release = () => {
      unsubscribe();
      model?.destroy();
      useCollab.getState().setPen(null);
      useCollab.getState().setEditingNote(null);
    };
  };

  return {
    open: false,
    expanded: false,
    boardId: null,
    book: null,
    sheetId: MAIN_SHEET,
    model: null,
    tool: 'pen',
    color: 'ink',
    sizeStep: 1,
    noteColor: 'yellow',

    show: (boardId, team) => {
      if (get().open && get().boardId === boardId) return;
      detach();
      const mine = generation;
      set({ open: true, boardId });
      if (team) attachTeam(boardId, mine);
      else void attachLocal(boardId, mine);
    },

    hide: () => {
      detach();
      set({ open: false, boardId: null });
    },

    toggleExpanded: () => set({ expanded: !get().expanded }),

    selectSheet: (sheetId) => {
      const { book } = get();
      if (book) openSheet(book, sheetId);
    },

    addSheet: () => {
      const { book } = get();
      if (book) openSheet(book, book.add());
    },

    renameSheet: (sheetId, name) => get().book?.rename(sheetId, name),

    removeSheet: (sheetId) => get().book?.remove(sheetId),

    setTool: (tool) => set({ tool }),
    // Picking a color while erasing or pointing means "I want to draw again".
    setColor: (color) =>
      set({ color, tool: get().tool === 'eraser' || get().tool === 'laser' ? 'pen' : get().tool }),
    setSizeStep: (sizeStep) => set({ sizeStep }),
    setNoteColor: (noteColor) => set({ noteColor }),

    forget: async (boardId) => {
      if (get().boardId === boardId) get().hide();
      const { forgetLocalSketch } = await loadSketch();
      await forgetLocalSketch(boardId);
      try {
        localStorage.removeItem(lastSheetKey(boardId));
      } catch {
        /* storage blocked */
      }
    },
  };
});

const EMPTY: SketchSnapshot = { strokes: [], notes: [], canUndo: false, canRedo: false };
const NO_SHEETS: readonly SheetInfo[] = [];
const noop = () => () => {};

/** Strokes, notes and undo state of the open whiteboard; re-renders only when they change. */
export function useSketchSnapshot(): SketchSnapshot {
  const model = useSketch((s) => s.model);
  return useSyncExternalStore(
    model ? model.subscribe : noop,
    model ? model.getSnapshot : () => EMPTY,
  );
}

/** The whiteboards of the open personal board (empty on team boards). */
export function useSketchSheets(): readonly SheetInfo[] {
  const book = useSketch((s) => s.book);
  return useSyncExternalStore(
    book ? book.subscribe : noop,
    book ? book.getSheets : () => NO_SHEETS,
  );
}
