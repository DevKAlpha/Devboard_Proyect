/**
 * Model layer: board storage contract + in-memory implementation.
 *
 * The in-memory store is a placeholder so the API is runnable today. A
 * database-backed store (e.g. PostgreSQL) will implement the same interface,
 * and services will not change.
 */
import type { Board } from '@devbord/shared';

export interface BoardStore {
  list(): Promise<Board[]>;
  get(id: string): Promise<Board | null>;
  save(board: Board): Promise<void>;
  remove(id: string): Promise<boolean>;
}

export class InMemoryBoardStore implements BoardStore {
  private readonly boards = new Map<string, Board>();

  async list() {
    return [...this.boards.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string) {
    return this.boards.get(id) ?? null;
  }

  async save(board: Board) {
    this.boards.set(board.id, board);
  }

  async remove(id: string) {
    return this.boards.delete(id);
  }
}
