/**
 * Connections controller: which work accounts are signed in on this tab, the
 * sign-in intents, and the Slack notice sent when cards change column.
 * The provider calls live in `integrations/`; views only use this store.
 */
import { create } from 'zustand';
import type { Board } from '@devbord/shared';
import { getToken, signIn, signOut, type AccountId } from '../integrations/accounts';
import { moveMessage, postToSlack, readSlack } from '../integrations/slack';

interface ConnectionsState {
  signedIn: Record<AccountId, boolean>;
  /** Account whose sign-in popup is open. */
  busy: AccountId | null;
  error: string | null;
  connect: (id: AccountId) => Promise<void>;
  disconnect: (id: AccountId) => void;
  /** Re-reads the stored tokens (they expire after about an hour). */
  refresh: () => void;
}

const readSignedIn = (): Record<AccountId, boolean> => ({
  google: getToken('google') !== null,
  microsoft: getToken('microsoft') !== null,
});

export const useConnections = create<ConnectionsState>((set) => ({
  signedIn: readSignedIn(),
  busy: null,
  error: null,
  connect: async (id) => {
    set({ busy: id, error: null });
    try {
      await signIn(id);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'No se pudo conectar.' });
    } finally {
      set({ busy: null, signedIn: readSignedIn() });
    }
  },
  disconnect: (id) => {
    signOut(id);
    set({ signedIn: readSignedIn() });
  },
  refresh: () => set({ signedIn: readSignedIn() }),
}));

/**
 * Tells the board's Slack channel (if it has one) that cards are about to
 * change column. Takes the board *before* the move, so cards already in the
 * target column are left out. Fire-and-forget: a failed notice never blocks
 * the move.
 */
export function announceMove(board: Board, cardIds: string[], toColumnId: string) {
  const config = readSlack(board.id);
  if (!config) return;
  const index = board.columns.findIndex((c) => c.id === toColumnId);
  const to = board.columns[index];
  if (!to) return;
  // The last column is "done", the same rule the board uses for its celebration.
  const done = index === board.columns.length - 1;
  if (config.notify === 'done' && !done) return;
  const ids = new Set(cardIds);
  const cards = board.columns.flatMap((col) =>
    col.id === toColumnId ? [] : col.cards.filter((c) => ids.has(c.id)),
  );
  if (cards.length === 0) return;
  void postToSlack(
    config.webhook,
    moveMessage({ boardName: board.name, cards, to: to.title, done }),
  ).catch(() => undefined);
}
