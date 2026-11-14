/**
 * Live updates for open boards. Clients subscribe (SSE) to the Projects they
 * have on screen; the hub tells them "changed" and they fetch the snapshot.
 *
 * Two triggers:
 *  - webhooks (instant), mapped to Projects by id or by repository;
 *  - polling every few seconds of the Projects with subscribers, because
 *    GitHub sends Project item webhooks for organization Projects only.
 */
import { createHash } from 'node:crypto';
import type { Board } from '@devbord/shared';

export type Listener = (event: 'changed', data: { projectId: string }) => void;

/** Fingerprint of what the board shows (ignores the snapshot's own timestamp). */
export const boardHash = (board: Board) =>
  createHash('sha1')
    .update(JSON.stringify([board.name, board.labels, board.columns, board.github]))
    .digest('base64url');

export class LiveHub {
  private readonly subs = new Map<string, Map<Listener, string>>();
  private readonly hashes = new Map<string, string>();
  private readonly repos = new Map<string, Set<string>>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    /** Loads a Project as one of its subscribers (whose session pays the API quota). */
    private readonly load: (projectId: string, sessionId: string) => Promise<unknown>,
    private readonly pollMs: number,
  ) {}

  subscribe(projectId: string, sessionId: string, listener: Listener) {
    let list = this.subs.get(projectId);
    if (!list) this.subs.set(projectId, (list = new Map()));
    list.set(listener, sessionId);
    if (!this.timer && this.pollMs > 0) {
      this.timer = setInterval(() => void this.poll(), this.pollMs);
      this.timer.unref?.();
    }
    return () => {
      list.delete(listener);
      if (list.size === 0) this.subs.delete(projectId);
      if (this.subs.size === 0) this.stop();
    };
  }

  /**
   * Records the latest snapshot of a Project. Returns true when it differs
   * from the previous one, so a reload (poll or op) can tell the others.
   */
  record(board: Board, repos: string[]) {
    const projectId = board.github?.projectId ?? board.id;
    const hash = boardHash(board);
    const changed = this.hashes.has(projectId) && this.hashes.get(projectId) !== hash;
    this.hashes.set(projectId, hash);
    this.repos.set(projectId, new Set(repos));
    return changed;
  }

  notify(projectId: string) {
    for (const listener of this.subs.get(projectId)?.keys() ?? []) {
      listener('changed', { projectId });
    }
  }

  /** Projects (with subscribers) that show items of this repository ("owner/name"). */
  projectsOfRepo(repo: string) {
    return [...this.subs.keys()].filter((id) => this.repos.get(id)?.has(repo));
  }

  /** One round of polling: reload each watched Project; `record` decides if it changed. */
  async poll() {
    await Promise.all(
      [...this.subs.entries()].map(async ([projectId, list]) => {
        const sessionId = list.values().next().value;
        if (!sessionId) return;
        try {
          await this.load(projectId, sessionId);
        } catch (e) {
          console.warn('[github] poll failed', projectId, e instanceof Error ? e.message : e);
        }
      }),
    );
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
