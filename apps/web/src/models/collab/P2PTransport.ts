/**
 * Peer-to-peer transport (WebRTC) built on Trystero.
 *
 * Browsers find each other through public Nostr relays (signaling only), then
 * talk directly. The room `password` (the board's share key) encrypts the
 * signaling, and WebRTC encrypts the data channel, so relays never see board
 * content. No server of ours is needed, which is why this works on GitHub Pages.
 *
 * Trade-off: changes only travel while at least two people are online. Each
 * browser keeps its own copy, and copies merge (CRDT) when they meet again.
 */
import { joinRoom, selfId, type JsonValue } from 'trystero';
import type { CollabChannel, CollabTransport, Presence } from './CollabTransport';

/** Namespaces the rooms so other Trystero apps never collide with ours. */
const APP_ID = 'devbord.app/v1';

export class P2PTransport implements CollabTransport {
  join(roomId: string, secret: string): CollabChannel {
    const room = joinRoom({ appId: APP_ID, password: secret }, roomId);
    // Action names are short on purpose: Trystero caps them at 12 bytes.
    const update = room.makeAction<Uint8Array>('yupdate');
    const presence = room.makeAction<JsonValue>('presence');
    const target = (peerId?: string) => (peerId ? { target: peerId } : undefined);

    return {
      selfId,
      sendUpdate: (data, peerId) => void update.send(data, target(peerId)).catch(() => {}),
      sendPresence: (data, peerId) =>
        void presence.send(data as unknown as JsonValue, target(peerId)).catch(() => {}),
      onUpdate: (handler) => {
        update.onMessage = (data, { peerId }) => handler(new Uint8Array(data), peerId);
      },
      onPresence: (handler) => {
        presence.onMessage = (data, { peerId }) => handler(data as unknown as Presence, peerId);
      },
      onPeerJoin: (handler) => {
        room.onPeerJoin = handler;
      },
      onPeerLeave: (handler) => {
        room.onPeerLeave = handler;
      },
      leave: () => void room.leave(),
    };
  }
}
