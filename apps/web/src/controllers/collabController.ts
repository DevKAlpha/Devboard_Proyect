/**
 * Collaboration controller: real-time sync and presence for team boards.
 *
 * Flow for the open team board:
 *   local edit  → boardController (pure ops, as always) → this controller sees
 *                 the new board → writeBoard() into the Yjs doc → the doc emits
 *                 an update → sent to every peer.
 *   peer update → applied to the doc → readBoard() → boardController.receiveBoard().
 *
 * Only one team board is live at a time (the one on screen). Personal boards
 * never touch this controller.
 *
 * Yjs and the WebRTC stack are loaded on demand (dynamic import), so personal
 * boards never download them.
 */
import type * as Y from 'yjs';
import { create } from 'zustand';
import type { Board } from '@devbord/shared';
import type { CollabChannel, Presence } from '../models/collab';
import { useBoardController } from './boardController';
import { useIdentity } from './identityController';

/** Lazy-loads the collaboration stack (cached by the bundler after the first call). */
const loadCollab = () => Promise.all([import('../models/collab'), import('yjs')]);

export type CollabStatus = 'idle' | 'connecting' | 'online' | 'alone';

interface CollabState {
  boardId: string | null;
  status: CollabStatus;
  /** Other people in the room, by peer id. */
  peers: Record<string, Presence>;
  /**
   * The live document of the open team board. The whiteboard stores its
   * strokes and notes in it, so they sync over the same session.
   */
  doc: Y.Doc | null;
  /** Starts syncing a team board (seeded from the local copy if this browser has no history yet). */
  open: (board: Board) => Promise<void>;
  /** Joins a team board from an invite link; the board arrives from a teammate. */
  join: (boardId: string, shareKey: string) => Promise<void>;
  close: () => void;
  /** Leaves and deletes this browser's copy of a team board's history (on board delete). */
  forget: (boardId: string) => Promise<void>;
  /** Our pointer over the board (content coordinates), or null when it leaves. */
  setCursor: (cursor: Presence['cursor']) => void;
  /** Our pointer over the whiteboard (sheet coordinates), or null when away. */
  setPen: (pen: Presence['pen']) => void;
  /** The whiteboard note we are typing in, or null. */
  setEditingNote: (noteId: string | null) => void;
}

/** If nobody answers in this time, show "solo tú" (peers may still join later). */
const ALONE_AFTER_MS = 6000;
const SAVE_DEBOUNCE_MS = 400;
const CURSOR_INTERVAL_MS = 50;

interface Session {
  boardId: string;
  doc: Y.Doc;
  channel: CollabChannel;
  /** Last board read from the doc: the store echo of it must not be written back. */
  lastFromDoc: Board | null;
  cleanups: Array<() => void>;
}

let session: Session | null = null;
/** Bumped by every start/close: a slow start that lost the race must not connect. */
let generation = 0;

export const useCollab = create<CollabState>((set, get) => {
  const me = (): Presence => {
    const { name, color } = useIdentity.getState();
    return { name: name || 'Invitado', color, cursor, pen, editingNote };
  };
  let cursor: Presence['cursor'] = null;
  let pen: Presence['pen'] = null;
  let editingNote: string | null = null;
  let lastCursorSent = 0;
  let cursorTimer: ReturnType<typeof setTimeout> | undefined;

  const start = async (boardId: string, shareKey: string, seed: Board | null) => {
    if (session?.boardId === boardId) return;
    get().close();
    const mine = ++generation;

    const [{ collabTransport, docStore, readBoard, writeBoard }, Y] = await loadCollab();
    const stored = await docStore.get(boardId);
    if (mine !== generation) return; // closed or replaced while loading
    const doc = new Y.Doc();
    if (stored) Y.applyUpdate(doc, stored, 'load');
    else if (seed) writeBoard(doc, seed, 'load');

    const channel = collabTransport.join(boardId, shareKey);
    const current: Session = { boardId, doc, channel, lastFromDoc: null, cleanups: [] };
    session = current;
    set({ boardId, status: 'connecting', peers: {}, doc });

    // Doc → network, storage and (for remote changes) the app.
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    // Typed as the generic parent type: Yjs keys transaction maps by AbstractType.
    const boardRoot = doc.getMap('board') as unknown as Parameters<
      Y.Transaction['changed']['has']
    >[0];
    const onDocUpdate = (update: Uint8Array, origin: unknown, _doc: Y.Doc, tr: Y.Transaction) => {
      if (origin !== 'remote' && origin !== 'load') channel.sendUpdate(update);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(
        () => void docStore.put(boardId, Y.encodeStateAsUpdate(doc)),
        SAVE_DEBOUNCE_MS,
      );
      // Whiteboard-only updates leave the board untouched: skip the re-read.
      const touchesBoard = tr.changed.has(boardRoot) || tr.changedParentTypes.has(boardRoot);
      if (origin === 'remote' && touchesBoard) {
        const board = readBoard(doc);
        if (board) {
          current.lastFromDoc = board;
          useBoardController.getState().receiveBoard(board);
        }
      }
    };
    doc.on('update', onDocUpdate);
    if (!stored && seed) void docStore.put(boardId, Y.encodeStateAsUpdate(doc));

    // App → doc: any change to this board that did not come from the doc.
    const unsubscribe = useBoardController.subscribe((state) => {
      const board = state.boards.find((b) => b.id === boardId);
      if (!board || board === current.lastFromDoc) return;
      current.lastFromDoc = board;
      writeBoard(doc, board, 'local');
    });

    channel.onUpdate((update) => Y.applyUpdate(doc, update, 'remote'));
    channel.onPeerJoin((peerId) => {
      // Send everything we have; Yjs ignores what the peer already knows.
      channel.sendUpdate(Y.encodeStateAsUpdate(doc), peerId);
      channel.sendPresence(me(), peerId);
      set({ status: 'online' });
    });
    channel.onPeerLeave((peerId) => {
      const peers = { ...get().peers };
      delete peers[peerId];
      set({ peers, status: Object.keys(peers).length ? 'online' : 'alone' });
    });
    channel.onPresence((presence, peerId) =>
      set({ peers: { ...get().peers, [peerId]: presence }, status: 'online' }),
    );

    // Renaming yourself updates everyone's view of you.
    const unsubIdentity = useIdentity.subscribe(() => channel.sendPresence(me()));
    const aloneTimer = setTimeout(() => {
      if (get().status === 'connecting') set({ status: 'alone' });
    }, ALONE_AFTER_MS);

    current.cleanups.push(
      () => doc.off('update', onDocUpdate),
      unsubscribe,
      unsubIdentity,
      () => clearTimeout(aloneTimer),
      () => {
        // Flush the latest state before leaving.
        clearTimeout(saveTimer);
        void docStore.put(boardId, Y.encodeStateAsUpdate(doc));
      },
    );
  };

  return {
    boardId: null,
    status: 'idle',
    peers: {},
    doc: null,

    open: (board) =>
      board.mode === 'team' && board.shareKey
        ? start(board.id, board.shareKey, board)
        : Promise.resolve(),

    join: (boardId, shareKey) => start(boardId, shareKey, null),

    close: () => {
      generation++;
      if (!session) return;
      const { channel, doc, cleanups } = session;
      session = null;
      cleanups.forEach((fn) => fn());
      clearTimeout(cursorTimer);
      channel.leave();
      doc.destroy();
      set({ boardId: null, status: 'idle', peers: {}, doc: null });
    },

    forget: async (boardId) => {
      if (session?.boardId === boardId) get().close();
      const [{ docStore }] = await loadCollab();
      await docStore.remove(boardId);
    },

    setCursor: (next) => {
      cursor = next;
      sendPresenceSoon();
    },

    setPen: (next) => {
      pen = next;
      sendPresenceSoon();
    },

    setEditingNote: (noteId) => {
      if (editingNote === noteId) return;
      editingNote = noteId;
      sendPresenceSoon();
    },
  };

  /** Throttled presence: at most one message every CURSOR_INTERVAL_MS. */
  function sendPresenceSoon() {
    if (!session) return;
    // Throttle: at most one cursor message every CURSOR_INTERVAL_MS.
    const wait = CURSOR_INTERVAL_MS - (Date.now() - lastCursorSent);
    clearTimeout(cursorTimer);
    const send = () => {
      lastCursorSent = Date.now();
      session?.channel.sendPresence(me());
    };
    if (wait <= 0) send();
    else cursorTimer = setTimeout(send, wait);
  }
});

/** Invite link for a team board (the share key travels in the URL fragment, never to a server). */
export const inviteLink = (board: Board) =>
  `${location.origin}${location.pathname}#/join/${board.id}/${board.shareKey}`;
