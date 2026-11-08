/**
 * IndexedDB implementation of BoardRepository, built on Dexie.
 *
 * Data read from storage is validated with the shared zod schema, so a
 * corrupted or outdated record is skipped instead of crashing the UI.
 */
import Dexie, { type EntityTable } from 'dexie';
import { BoardSchema, type Board } from '@devbord/shared';
import type { BoardRepository } from './BoardRepository';

class DevbordDb extends Dexie {
  boards!: EntityTable<Board, 'id'>;

  constructor(name: string) {
    super(name);
    // Schema v1: primary key `id`, index on `updatedAt` for ordering.
    // Add new versions below (never edit this one) when the schema changes.
    this.version(1).stores({ boards: 'id, updatedAt' });
  }
}

const parse = (raw: unknown): Board | null => {
  const result = BoardSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[devbord] Skipping invalid board record', result.error.issues);
    return null;
  }
  return result.data;
};

export class IndexedDbBoardRepository implements BoardRepository {
  private readonly db: DevbordDb;

  /** @param dbName Override in tests to get an isolated database. */
  constructor(dbName = 'devbord') {
    this.db = new DevbordDb(dbName);
  }

  async list(): Promise<Board[]> {
    const rows = await this.db.boards.orderBy('updatedAt').reverse().toArray();
    return rows.map(parse).filter((b): b is Board => b !== null);
  }

  async get(id: string): Promise<Board | null> {
    const row = await this.db.boards.get(id);
    return row ? parse(row) : null;
  }

  async save(board: Board): Promise<void> {
    await this.db.boards.put(board);
  }

  async remove(id: string): Promise<void> {
    await this.db.boards.delete(id);
  }
}
