/**
 * Lobby controller: who is using Devbord right now (the rubber ducks on the home page).
 *
 * Every open Devbord joins one public room over the same real-time transport
 * as team boards and announces only what kind of participant it is (person or
 * agent). No names, no board data: strangers share this room, so it carries
 * nothing personal. Each participant is one duck in the pond.
 *
 * Agents (AI helpers, integrations) join the same room with `kind: 'agent'`
 * and get their own duck, so the pond shows everyone working, human or not.
 */
import { create } from 'zustand';
import type { CollabChannel, Presence } from '../models/collab/CollabTransport';

export type LobbyKind = NonNullable<Presence['kind']>;

/** Public room: same for everyone, so the secret is not a secret (nothing private travels here). */
const LOBBY_ROOM = 'lobby';
const LOBBY_SECRET = 'devbord-public-lobby';

interface LobbyState {
  /** Our own id in the room (null until connected). */
  selfId: string | null;
  /** Everyone else online, by peer id. */
  peers: Record<string, LobbyKind>;
  /** Joins the lobby once per page load; later calls do nothing. */
  start: () => Promise<void>;
}

let channel: CollabChannel | null = null;

export const useLobby = create<LobbyState>((set) => ({
  selfId: null,
  peers: {},
  start: async () => {
    if (channel || typeof RTCPeerConnection === 'undefined') return;
    // Only the transport is loaded here (not Yjs): the lobby exchanges no documents.
    const { P2PTransport } = await import('../models/collab/P2PTransport');
    if (channel) return;
    channel = new P2PTransport().join(LOBBY_ROOM, LOBBY_SECRET);
    const hello: Presence = { name: '', color: '', cursor: null, kind: 'user' };

    channel.onPeerJoin((peerId) => {
      channel?.sendPresence(hello, peerId);
      // Counted right away as a person; the hello may correct it to "agent".
      set((s) => ({ peers: { ...s.peers, [peerId]: s.peers[peerId] ?? 'user' } }));
    });
    channel.onPresence((presence, peerId) => {
      const kind: LobbyKind = presence.kind === 'agent' ? 'agent' : 'user';
      set((s) => ({ peers: { ...s.peers, [peerId]: kind } }));
    });
    channel.onPeerLeave((peerId) =>
      set((s) => {
        const peers = { ...s.peers };
        delete peers[peerId];
        return { peers };
      }),
    );
    set({ selfId: channel.selfId });
  },
}));
