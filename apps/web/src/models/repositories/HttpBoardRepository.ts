/**
 * HTTP implementation of BoardRepository, backed by apps/api.
 *
 * Not wired in yet (GitHub Pages has no backend). To enable it, set
 * `VITE_API_URL` and switch the export in ./index.ts.
 */
import { BoardSchema, type Board } from '@devbord/shared';
import type { BoardRepository } from './BoardRepository';

export class HttpBoardRepository implements BoardRepository {
  constructor(private readonly baseUrl: string) {}

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/boards${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`API ${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
    }
    return res;
  }

  async list(): Promise<Board[]> {
    const data: unknown = await (await this.request('')).json();
    return BoardSchema.array().parse(data);
  }

  async get(id: string): Promise<Board | null> {
    const res = await this.request(`/${encodeURIComponent(id)}`);
    return res.status === 404 ? null : BoardSchema.parse(await res.json());
  }

  async save(board: Board): Promise<void> {
    await this.request(`/${encodeURIComponent(board.id)}`, {
      method: 'PUT',
      body: JSON.stringify(board),
    });
  }

  async remove(id: string): Promise<void> {
    await this.request(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
