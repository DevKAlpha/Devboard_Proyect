/**
 * GitHub controller: boards that mirror a GitHub Project (Zenhub-style).
 *
 * - Devbord to GitHub: boardController applies each intent at once
 *   (optimistic) and hands the matching ops here; they are sent in order, one
 *   at a time, and the snapshot the API answers with replaces the board.
 * - GitHub to Devbord: while a linked board is open, the API's live stream says
 *   "changed" (webhook or polling) and the board reloads its snapshot.
 *
 * Snapshots go through mergeSnapshot, which keeps Devbord-only settings.
 */
import { create } from 'zustand';
import { mergeSnapshot, newId, type Board, type GithubOp } from '@devbord/shared';
import {
  GITHUB_API,
  GithubApiError,
  githubApi,
  githubSession,
  watchProject,
  type GithubProjectSummary,
} from '../integrations/github/client';
import { setGithubSink, useBoardController } from './boardController';

/** live: in sync and listening; syncing: writing to GitHub; offline: stream down. */
export type SyncState = 'off' | 'live' | 'syncing' | 'offline' | 'error';

interface GithubState {
  /** False when this build has no API URL: GitHub shows as "not set up". */
  configured: boolean;
  user: { login: string; avatarUrl: string } | null;
  busy: boolean;
  error: string | null;
  sync: SyncState;
  /** Loads the signed-in user, if a session exists. */
  init: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  listProjects: () => Promise<{ projects: GithubProjectSummary[]; installUrl: string }>;
  /** Opens a Project as a board (creates it the first time). Returns the board id. */
  openProject: (projectId: string) => Promise<string>;
  /** Keeps a linked board in sync while it is on screen. Returns the stop function. */
  watch: (boardId: string) => () => void;
  refresh: (boardId: string) => Promise<void>;
  /** GitHub-only intents (no local equivalent): assignees and epic. */
  setAssignees: (boardId: string, cardId: string, logins: string[]) => void;
  setEpic: (boardId: string, cardId: string, parentCardId: string | null) => void;
  clearError: () => void;
}

const boards = () => useBoardController.getState().boards;
const boardById = (id: string) => boards().find((b) => b.id === id);

const message = (e: unknown) =>
  e instanceof GithubApiError || e instanceof Error ? e.message : 'Error con GitHub.';

/** Ops waiting or running per board; snapshots only land when it reaches 0. */
const pending = new Map<string, number>();
const queues = new Map<string, Promise<void>>();

export const useGithub = create<GithubState>((set, get) => {
  /** Replaces a linked board with GitHub's version, keeping Devbord-only data. */
  const apply = (boardId: string, remote: Board) => {
    if (pending.get(boardId)) return; // a newer local change is still on its way
    const local = boardById(boardId);
    if (!local) return;
    useBoardController.getState().receiveBoard(mergeSnapshot(local, remote));
  };

  const fail = (e: unknown, boardId?: string) => {
    if (e instanceof GithubApiError && e.status === 401) set({ user: null });
    set({ error: message(e), sync: 'error' });
    // GitHub refused: show what it really has.
    if (boardId) void get().refresh(boardId);
  };

  /** Sends ops in order; one board's ops never overlap. */
  const enqueue = (board: Board, ops: GithubOp[]) => {
    const projectId = board.github?.projectId;
    if (!projectId) return;
    const boardId = board.id;
    pending.set(boardId, (pending.get(boardId) ?? 0) + ops.length);
    set({ sync: 'syncing' });
    let chain = queues.get(boardId) ?? Promise.resolve();
    for (const op of ops) {
      chain = chain.then(async () => {
        try {
          const { board: remote } = await githubApi.op(projectId, op);
          pending.set(boardId, (pending.get(boardId) ?? 1) - 1);
          apply(boardId, remote);
          if (!pending.get(boardId)) set({ sync: 'live' });
        } catch (e) {
          pending.set(boardId, (pending.get(boardId) ?? 1) - 1);
          fail(e, boardId);
        }
      });
    }
    queues.set(boardId, chain);
  };

  setGithubSink(enqueue);

  return {
    configured: GITHUB_API !== null,
    user: null,
    busy: false,
    error: null,
    sync: 'off',

    init: async () => {
      if (!GITHUB_API || !githubSession() || get().user) return;
      try {
        set({ user: await githubApi.me() });
      } catch (e) {
        if (e instanceof GithubApiError && e.status === 401) set({ user: null });
      }
    },

    signIn: async () => {
      set({ busy: true, error: null });
      try {
        await githubApi.signIn();
        set({ user: await githubApi.me() });
      } catch (e) {
        set({ error: message(e) });
      } finally {
        set({ busy: false });
      }
    },

    signOut: async () => {
      await githubApi.signOut();
      set({ user: null, sync: 'off' });
    },

    listProjects: () => githubApi.projects(),

    openProject: async (projectId) => {
      const existing = boards().find((b) => b.github?.projectId === projectId);
      if (existing) {
        void get().refresh(existing.id);
        return existing.id;
      }
      const remote = await githubApi.board(projectId);
      const board = await useBoardController
        .getState()
        .addBoard(mergeSnapshot(undefined, { ...remote, id: newId() }));
      return board.id;
    },

    watch: (boardId) => {
      const projectId = boardById(boardId)?.github?.projectId;
      if (!projectId || !GITHUB_API) return () => undefined;
      void get().init();
      void get().refresh(boardId);
      const stop = watchProject(
        projectId,
        () => void get().refresh(boardId),
        (live) => {
          if (get().sync !== 'syncing') set({ sync: live ? 'live' : 'offline' });
          // Coming back online: catch up on what changed meanwhile.
          if (live) void get().refresh(boardId);
        },
      );
      return () => {
        stop();
        set({ sync: 'off' });
      };
    },

    refresh: async (boardId) => {
      const projectId = boardById(boardId)?.github?.projectId;
      if (!projectId || !githubSession()) return;
      try {
        apply(boardId, await githubApi.board(projectId));
      } catch (e) {
        set({ error: message(e), sync: 'error' });
        if (e instanceof GithubApiError && e.status === 401) set({ user: null });
      }
    },

    setAssignees: (boardId, cardId, logins) => {
      const board = boardById(boardId);
      if (board) enqueue(board, [{ type: 'setAssignees', cardId, logins }]);
    },
    setEpic: (boardId, cardId, parentCardId) => {
      const board = boardById(boardId);
      if (board) enqueue(board, [{ type: 'setParent', cardId, parentCardId }]);
    },
    clearError: () => set({ error: null }),
  };
});
