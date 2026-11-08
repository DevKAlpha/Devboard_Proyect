/**
 * Service layer: business rules for boards, independent of HTTP.
 * Controllers translate HTTP into calls here; the store handles persistence.
 */
import { BoardSchema, type Board } from '@devbord/shared';
import { HttpError } from '../middleware/errors';
import type { BoardStore } from '../models/BoardStore';

export class BoardService {
  constructor(private readonly store: BoardStore) {}

  list(): Promise<Board[]> {
    return this.store.list();
  }

  async get(id: string): Promise<Board> {
    const board = await this.store.get(id);
    if (!board) throw new HttpError(404, 'board_not_found', `Board ${id} not found`);
    return board;
  }

  /**
   * Upsert. Boards are created client-side (offline-first), so the client
   * owns the id and PUT is idempotent.
   */
  async put(id: string, body: unknown): Promise<Board> {
    const board = BoardSchema.parse(body);
    if (board.id !== id) throw new HttpError(400, 'id_mismatch', 'Body id must match URL id');
    await this.store.save(board);
    return board;
  }

  async remove(id: string): Promise<void> {
    if (!(await this.store.remove(id))) {
      throw new HttpError(404, 'board_not_found', `Board ${id} not found`);
    }
  }
}
