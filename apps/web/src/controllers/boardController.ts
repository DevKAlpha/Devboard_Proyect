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
import type {
  Board,
  BoardSkin,
  Card,
  CardPatch,
  GithubOp,
  NewBoardInput,
  Profile,
} from '@devbord/shared';
import { boardRepository, type BoardRepository } from '../models/repositories';
import { announceMove } from './connectionsController';

type Status = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Receives the GitHub ops of boards linked to a Project (set by
 * githubController, which owns the API calls; a callback avoids an import cycle).
 */
type GithubSink = (board: Board, ops: GithubOp[]) => void;
let githubSink: GithubSink | null = null;
export const setGithubSink = (sink: GithubSink | null) => {
  githubSink = sink;
};

/** Ops that move `cardIds` to where they are in `next` (after the card above each one). */
function moveOps(next: Board, cardIds: string[]): GithubOp[] {
  return cardIds.flatMap((cardId) => {
    const found = ops.findCard(next, cardId);
    if (!found) return [];
    const above = found.column.cards[found.index - 1];
    return [
      { type: 'moveCard', cardId, columnId: found.column.id, afterCardId: above?.id ?? null },
    ];
  });
}

/**
 * The GitHub part of a card patch, only what really changed: the detail form
 * saves every field, and each one is a separate write on GitHub. Links, type
 * and the rest stay in Devbord.
 */
function githubPatch(card: Card | undefined, patch: CardPatch) {
  const out: Record<string, unknown> = {};
  for (const key of ops.GITHUB_CARD_FIELDS) {
    if (key in patch && JSON.stringify(patch[key]) !== JSON.stringify(card?.[key])) {
      out[key] = patch[key];
    }
  }
  return Object.keys(out).length ? out : null;
}

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
  /** Seasonal look of the board (columns, cards, cursor, backdrop). */
  setSkin: (boardId: string, skin: BoardSkin) => void;

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
    const mutate = (
      boardId: string,
      op: (board: Board) => Board,
      /** For boards linked to GitHub: what to write to the Project. */
      toGithub?: (next: Board) => GithubOp[],
    ) => {
      const current = get().boards.find((b) => b.id === boardId);
      if (!current) return;
      const next = op(current);
      if (next === current) return; // no-op operations return the same reference
      set({ boards: get().boards.map((b) => (b.id === boardId ? next : b)) });
      void persist(next);
      if (next.github && toGithub && githubSink) {
        const out = toGithub(next);
        if (out.length) githubSink(next, out);
      }
    };
    /**
     * Column structure of a linked board is the Project's Status field, edited
     * on GitHub. Cards from other boards would need new issues: not offered.
     */
    const linked = (boardId: string) => Boolean(get().boards.find((b) => b.id === boardId)?.github);

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

      renameBoard: (id, name) =>
        name.trim() &&
        mutate(
          id,
          (b) => ops.renameBoard(b, name),
          () => [{ type: 'renameBoard', name: name.trim() }],
        ),
      setProfile: (id, profile) => mutate(id, (b) => ops.setBoardProfile(b, profile)),
      setSkin: (id, skin) => mutate(id, (b) => ops.setBoardSkin(b, skin)),

      addColumn: (id, title) =>
        title.trim() && !linked(id) && mutate(id, (b) => ops.addColumn(b, title)),
      renameColumn: (id, columnId, title) =>
        title.trim() && !linked(id) && mutate(id, (b) => ops.renameColumn(b, columnId, title)),
      removeColumn: (id, columnId) =>
        !linked(id) && mutate(id, (b) => ops.removeColumn(b, columnId)),
      moveColumn: (id, columnId, toIndex) =>
        !linked(id) && mutate(id, (b) => ops.moveColumn(b, columnId, toIndex)),
      setColumnDescription: (id, columnId, description) =>
        mutate(id, (b) => ops.setColumnDescription(b, columnId, description)),
      setWipLimit: (id, columnId, wipLimit) =>
        mutate(id, (b) => ops.setColumnWipLimit(b, columnId, wipLimit)),

      addCard: (id, columnId, title) =>
        title.trim() &&
        mutate(
          id,
          (b) =>
            // New cards start from the board template (e.g. the Scrum user story).
            ops.addNewCard(
              b,
              columnId,
              ops.createCard(title, { description: b.cardTemplate ?? '' }),
            ),
          (b) => [
            {
              type: 'createCard',
              columnId,
              title: title.trim(),
              description: b.cardTemplate ?? '',
            },
          ],
        ),
      updateCard: (id, cardId, patch) => {
        const board = get().boards.find((b) => b.id === id);
        const before = board ? ops.findCard(board, cardId)?.card : undefined;
        mutate(
          id,
          (b) => ops.updateCard(b, cardId, patch),
          () => {
            const out = githubPatch(before, patch);
            return out ? [{ type: 'updateCard', cardId, patch: out }] : [];
          },
        );
      },
      removeCard: (id, cardId) =>
        mutate(
          id,
          (b) => ops.removeCard(b, cardId),
          () => [{ type: 'removeCard', cardId }],
        ),
      moveCard: (id, cardId, toColumnId, toIndex) =>
        mutate(
          id,
          (b) => {
            announceMove(b, [cardId], toColumnId);
            return ops.moveCard(b, cardId, toColumnId, toIndex);
          },
          (next) => moveOps(next, [cardId]),
        ),
      moveCards: (id, cardIds, toColumnId, toIndex) =>
        mutate(
          id,
          (b) => {
            announceMove(b, cardIds, toColumnId);
            return ops.moveCards(b, cardIds, toColumnId, toIndex);
          },
          // Board order, so each card lands after the one placed before it.
          (next) =>
            moveOps(
              next,
              next.columns
                .flatMap((c) => c.cards.map((card) => card.id))
                .filter((cid) => cardIds.includes(cid)),
            ),
        ),
      importCards: ({ boardId, columnId, sourceBoardId, cardIds, move }) => {
        const source = get().boards.find((b) => b.id === sourceBoardId);
        if (!source || sourceBoardId === boardId || linked(boardId)) return;
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
