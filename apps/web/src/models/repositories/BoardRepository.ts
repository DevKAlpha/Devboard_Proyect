/**
 * Persistence contract for boards (the "M" boundary of MVC).
 *
 * Controllers depend ONLY on this interface. Today it is implemented with
 * IndexedDB (offline, GitHub Pages friendly). Tomorrow an HTTP implementation
 * talks to apps/api. Swapping them is a one-line change in ./index.ts.
 */
import type { Board } from '@devbord/shared';

export interface BoardRepository {
  /** All boards, most recently updated first. */
  list(): Promise<Board[]>;
  get(id: string): Promise<Board | null>;
  /** Insert or replace (boards are saved as one aggregate document). */
  save(board: Board): Promise<void>;
  remove(id: string): Promise<void>;
}
