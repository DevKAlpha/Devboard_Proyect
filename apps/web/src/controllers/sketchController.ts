/**
 * Whiteboard ("pizarra") controller: which board's sketch is open, the chosen
 * tool, and the live SketchModel the views draw from.
 *
 * Where the sketch lives:
 *  - Personal board: its own local document (models/sketch openLocalSketch).
 *  - Team board: inside the collaboration document of the live session, so
 *    teammates see strokes and notes as they happen. If the session is not
 *    ready yet, the model attaches as soon as it is.
 *
 * Yjs and the model load on first open (dynamic import), never at startup.
 */
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import type { SketchModel, SketchSnapshot } from '../models/sketch/SketchModel';
import type { InkColor, NoteColor, StrokeTool } from '../models/sketch/types';
import { useCollab } from './collabController';

export * from '../models/sketch/types';
export type { SketchModel } from '../models/sketch/SketchModel';

/** Everything the toolbar can pick: drawing tools plus note, text and eraser. */
export type SketchTool = StrokeTool | 'note' | 'text' | 'eraser';

/** Width presets per size step (sheet units). The marker paints 3× wider. */
export const SIZE_STEPS = [3, 6, 12] as const;

const loadSketch = () => import('../models/sketch');

interface SketchState {
  open: boolean;
  /** Fills the window instead of floating over the board. */
  expanded: boolean;
  boardId: string | null;
  model: SketchModel | null;
  tool: SketchTool;
  color: InkColor;
  sizeStep: 0 | 1 | 2;
  noteColor: NoteColor;

  show: (boardId: string, team: boolean) => void;
  hide: () => void;
  toggleExpanded: () => void;
  setTool: (tool: SketchTool) => void;
  setColor: (color: InkColor) => void;
  setSizeStep: (step: 0 | 1 | 2) => void;
  setNoteColor: (color: NoteColor) => void;
  /** Deletes the stored sketch of a personal board. */
  forget: (boardId: string) => Promise<void>;
}

/** Releases the current model (and its local document, for personal boards). */
let release: (() => void) | null = null;
/** Bumped on every show/hide: a slow load that lost the race is dropped. */
let generation = 0;

export const useSketch = create<SketchState>((set, get) => {
  const detach = () => {
    generation++;
    release?.();
    release = null;
    set({ model: null });
  };

  const attachLocal = async (boardId: string, mine: number) => {
    const { openLocalSketch } = await loadSketch();
    const local = await openLocalSketch(boardId);
    if (mine !== generation) return local.close();
    release = local.close;
    set({ model: local.model });
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
      const { sketchOnDoc } = await loadSketch();
      if (mine !== generation || useCollab.getState().doc !== wanted) return;
      model = sketchOnDoc(wanted);
      set({ model });
    };
    const unsubscribe = useCollab.subscribe((s, prev) => s.doc !== prev.doc && void sync());
    void sync();
    release = () => {
      unsubscribe();
      model?.destroy();
      useCollab.getState().setPen(null);
    };
  };

  return {
    open: false,
    expanded: false,
    boardId: null,
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
    setTool: (tool) => set({ tool }),
    // Picking a color while erasing means "I want to draw again".
    setColor: (color) => set({ color, tool: get().tool === 'eraser' ? 'pen' : get().tool }),
    setSizeStep: (sizeStep) => set({ sizeStep }),
    setNoteColor: (noteColor) => set({ noteColor }),

    forget: async (boardId) => {
      if (get().boardId === boardId) get().hide();
      const { forgetLocalSketch } = await loadSketch();
      await forgetLocalSketch(boardId);
    },
  };
});

const EMPTY: SketchSnapshot = { strokes: [], notes: [], canUndo: false, canRedo: false };
const noop = () => () => {};

/** Strokes, notes and undo state of the open sketch; re-renders only when they change. */
export function useSketchSnapshot(): SketchSnapshot {
  const model = useSketch((s) => s.model);
  return useSyncExternalStore(
    model ? model.subscribe : noop,
    model ? model.getSnapshot : () => EMPTY,
  );
}
