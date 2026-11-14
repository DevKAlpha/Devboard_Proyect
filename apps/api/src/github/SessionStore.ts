/**
 * Model: GitHub sessions in SQLite (node:sqlite, built into Node 24).
 *
 * The browser only holds an opaque session id. The GitHub tokens stay here,
 * encrypted (AES-GCM); rows are keyed by the id's hash. This is the only state
 * the GitHub module keeps: the board <-> Project link lives in the board.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { decrypt, encrypt, hashId } from './crypto';

export interface GithubSession {
  login: string;
  avatarUrl: string;
  accessToken: string;
  /** Epoch ms; null when the App issues tokens that do not expire. */
  accessExpiresAt: number | null;
  refreshToken: string | null;
  refreshExpiresAt: number | null;
}

interface Row {
  data: string;
  expires_at: number;
}

/** Sessions with no refresh token end after this long. */
const DEFAULT_TTL = 30 * 24 * 3600_000;

export class SessionStore {
  private readonly db: DatabaseSync;

  constructor(
    file: string,
    private readonly secret: string,
  ) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL)',
    );
  }

  save(id: string, session: GithubSession) {
    const expires = session.refreshExpiresAt ?? Date.now() + DEFAULT_TTL;
    this.db
      .prepare('INSERT OR REPLACE INTO sessions (id, data, expires_at) VALUES (?, ?, ?)')
      .run(hashId(id), encrypt(this.secret, JSON.stringify(session)), expires);
  }

  get(id: string): GithubSession | null {
    const row = this.db
      .prepare('SELECT data, expires_at FROM sessions WHERE id = ?')
      .get(hashId(id)) as Row | undefined;
    if (!row) return null;
    if (row.expires_at < Date.now()) {
      this.delete(id);
      return null;
    }
    try {
      return JSON.parse(decrypt(this.secret, row.data)) as GithubSession;
    } catch {
      // Secret rotated or row tampered: the session is simply gone.
      this.delete(id);
      return null;
    }
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(hashId(id));
  }

  /** Drops expired rows (called now and then; sessions are few). */
  prune() {
    this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  }
}
