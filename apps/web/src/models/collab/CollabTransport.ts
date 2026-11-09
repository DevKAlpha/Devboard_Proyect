/**
 * Real-time transport for team boards.
 *
 * The collaboration logic (controllers/collabController) only talks to this
 * interface, so the network can change without touching the UI:
 *  - P2PTransport (today): WebRTC between browsers, works on GitHub Pages.
 *  - A WebSocket transport against apps/api (planned, for Dokploy), selected
 *    in ./index.ts with VITE_COLLAB_URL.
 */

/** What each participant shares about themselves (no personal data beyond the chosen name). */
export interface Presence {
  name: string;
  /** Hex color of the cursor and avatar. */
  color: string;
  /** Pointer position in board-content coordinates (scroll included); null when away. */
  cursor: { x: number; y: number } | null;
  /** Pointer over the open whiteboard, in sheet units; null/absent when not on it. */
  /** `laser`: the laser pointer is pressed (teammates draw a fading trail). */
  pen?: { x: number; y: number; laser?: boolean } | null;
  /** Sticky note this person is typing in, so others see who is writing where. */
  editingNote?: string | null;
  /** Lobby only: a person or an agent (AI helper, integration). Absent means person. */
  kind?: 'user' | 'agent';
}

export interface CollabChannel {
  /** Our own peer id in the room. */
  readonly selfId: string;
  /** Sends a Yjs update to everyone, or to one peer. */
  sendUpdate(update: Uint8Array, peerId?: string): void;
  sendPresence(presence: Presence, peerId?: string): void;
  onUpdate(handler: (update: Uint8Array, peerId: string) => void): void;
  onPresence(handler: (presence: Presence, peerId: string) => void): void;
  onPeerJoin(handler: (peerId: string) => void): void;
  onPeerLeave(handler: (peerId: string) => void): void;
  leave(): void;
}

export interface CollabTransport {
  /**
   * Joins the room of one team board. `secret` comes from the invite link:
   * only people who have it can connect or read the traffic.
   */
  join(roomId: string, secret: string): CollabChannel;
}
