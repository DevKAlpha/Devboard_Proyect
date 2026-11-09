/**
 * Board controller (the "C" of MVC).
 *
 * Owns the in-memory list of boards and every user intent that changes them.
 * Each intent applies a pure operation from @devbord/shared, updates state
 * optimistically (instant UI), then persists through the BoardRepository.
 *
 * Views call these actions and never touch persistence directly.
 */
import { create } from 'zustand';
import * as ops from '@devbord/shared';
import type { Board, CardPatch, NewBoardInput, Profile } from '@devbord/shared';
import { boardRepository, type BoardRepository } from '../models/repositories';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface BoardState {
  boards: Board[];
  status: Status;
  error: string | null;

  /** Loads boards from storage once (subsequent calls are no-ops unless `force`). */
  load: (force?: boolean) => Promise<void>;
  createBoard: (input: NewBoardInput) => Promise<Board>;
  /**
   * Stores a board that changed elsewhere (a teammate, via the collaboration
   * layer): inserts or replaces it and persists it locally.
   */
  receiveBoard: (board: Board) => void;
  /** Adds an already-built board (e.g. one created from a template). */
  addBoard: (board: Board) => Promise<Board>;
  deleteBoard: (boardId: string) => Promise<void>;
  renameBoard: (boardId: string, name: string) => void;
  setProfile: (boardId: string, profile: Profile) => void;

  addColumn: (boardId: string, title: string) => void;
  renameColumn: (boardId: string, columnId: string, title: string) => void;
  removeColumn: (boardId: string, columnId: string) => void;
  moveColumn: (boardId: string, columnId: string, toIndex: number) => void;
  /** Lean WIP limit for a column; null removes it. */
  setWipLimit: (boardId: string, columnId: string, wipLimit: number | null) => void;
  setColumnDescription: (boardId: string, columnId: string, description: string | null) => void;

  addCard: (boardId: string, columnId: string, title: string) => void;
  updateCard: (boardId: string, cardId: string, patch: CardPatch) => void;
  removeCard: (boardId: string, cardId: string) => void;
  moveCard: (boardId: string, cardId: string, toColumnId: string, toIndex: number) => void;
  /** Moves several selected cards as a block (see ops.moveCards). */
  moveCards: (boardId: string, cardIds: string[], toColumnId: string, toIndex: number) => void;
  /**
   * Brings cards from another board into `columnId`. `move` also removes the
   * originals from the source board; otherwise they are copied.
   */
  importCards: (input: {
    boardId: string;
    columnId: string;
    sourceBoardId: string;
    cardIds: string[];
    move: boolean;
  }) => void;
}

/**
 * Factory so tests can inject an isolated repository.
 * The app uses the default `useBoardController` instance below.
 */
export function createBoardController(repo: BoardRepository) {
  return create<BoardState>((set, get) => {
    /** Persists a board. Failures are surfaced in state but never lose the optimistic update. */
    const persist = (board: Board) =>
      repo.save(board).catch((e: unknown) => {
        console.error('[devbord] Failed to save board', e);
        set({ error: 'No se pudo guardar. Tus cambios siguen en pantalla.' });
      });

    /** Applies a pure operation to one board, then persists it if it changed. */
    const mutate = (boardId: string, op: (board: Board) => Board) => {
      const current = get().boards.find((b) => b.id === boardId);
      if (!current) return;
      const next = op(current);
      if (next === current) return; // no-op operations return the same reference
      set({ boards: get().boards.map((b) => (b.id === boardId ? next : b)) });
      void persist(next);
    };

    return {
      boards: [],
      status: 'idle',
      error: null,

      load: async (force = false) => {
        const { status } = get();
        if (!force && (status === 'loading' || status === 'ready')) return;
        set({ status: 'loading', error: null });
        try {
          set({ boards: await repo.list(), status: 'ready' });
        } catch (e) {
          console.error('[devbord] Failed to load boards', e);
          set({ status: 'error', error: 'No se pudieron cargar tus tableros.' });
        }
      },

      createBoard: (input) => get().addBoard(ops.createBoard(input)),

      addBoard: async (board) => {
        set({ boards: [board, ...get().boards] });
        await persist(board);
        return board;
      },

      receiveBoard: (board) => {
        const exists = get().boards.some((b) => b.id === board.id);
        set({
          boards: exists
            ? get().boards.map((b) => (b.id === board.id ? board : b))
            : [board, ...get().boards],
        });
        void persist(board);
      },

      deleteBoard: async (boardId) => {
        set({ boards: get().boards.filter((b) => b.id !== boardId) });
        await repo.remove(boardId);
      },

      renameBoard: (id, name) => name.trim() && mutate(id, (b) => ops.renameBoard(b, name)),
      setProfile: (id, profile) => mutate(id, (b) => ops.setBoardProfile(b, profile)),

      addColumn: (id, title) => title.trim() && mutate(id, (b) => ops.addColumn(b, title)),
      renameColumn: (id, columnId, title) =>
        title.trim() && mutate(id, (b) => ops.renameColumn(b, columnId, title)),
      removeColumn: (id, columnId) => mutate(id, (b) => ops.removeColumn(b, columnId)),
      moveColumn: (id, columnId, toIndex) =>
        mutate(id, (b) => ops.moveColumn(b, columnId, toIndex)),
      setColumnDescription: (id, columnId, description) =>
        mutate(id, (b) => ops.setColumnDescription(b, columnId, description)),
      setWipLimit: (id, columnId, wipLimit) =>
        mutate(id, (b) => ops.setColumnWipLimit(b, columnId, wipLimit)),

      addCard: (id, columnId, title) =>
        title.trim() &&
        mutate(id, (b) =>
          // New cards start from the board template (e.g. the Scrum user story).
          ops.addNewCard(b, columnId, ops.createCard(title, { description: b.cardTemplate ?? '' })),
        ),
      updateCard: (id, cardId, patch) => mutate(id, (b) => ops.updateCard(b, cardId, patch)),
      removeCard: (id, cardId) => mutate(id, (b) => ops.removeCard(b, cardId)),
      moveCard: (id, cardId, toColumnId, toIndex) =>
        mutate(id, (b) => ops.moveCard(b, cardId, toColumnId, toIndex)),
      moveCards: (id, cardIds, toColumnId, toIndex) =>
        mutate(id, (b) => ops.moveCards(b, cardIds, toColumnId, toIndex)),
      importCards: ({ boardId, columnId, sourceBoardId, cardIds, move }) => {
        const source = get().boards.find((b) => b.id === sourceBoardId);
        if (!source || sourceBoardId === boardId) return;
        mutate(boardId, (b) => ops.copyCardsInto(b, columnId, source, cardIds));
        if (move) {
          mutate(sourceBoardId, (b) => cardIds.reduce((acc, id) => ops.removeCard(acc, id), b));
        }
      },
    };
  });
}

export const useBoardController = createBoardController(boardRepository);

/** Selector hook: one board by id (undefined while loading or if missing). */
export const useBoard = (boardId: string | undefined) =>
  useBoardController((s) => s.boards.find((b) => b.id === boardId));
