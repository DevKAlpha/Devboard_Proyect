/**
 * Composition root for collaboration (same idea as models/repositories).
 *
 * Today every team board uses the P2P transport. When apps/api ships a
 * WebSocket room server, set VITE_COLLAB_URL and return that transport here;
 * controllers and views do not change.
 */
import type { CollabTransport } from './CollabTransport';
import { P2PTransport } from './P2PTransport';

export type { CollabChannel, CollabTransport, Presence } from './CollabTransport';
export { readBoard, writeBoard } from './yBoard';
export { docStore } from './docStore';

export const collabTransport: CollabTransport = new P2PTransport();
