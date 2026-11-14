/**
 * Client of the Devbord API's GitHub module (apps/api/src/github). GitHub
 * itself is never called from the browser: the API holds the GitHub App
 * tokens and writes to the Project as the signed-in user.
 *
 * The API URL comes from VITE_GITHUB_API_URL (or VITE_API_URL). Without it
 * the GitHub connection shows as "not set up" (see docs/github.md).
 */
import type { Board, GithubOp } from '@devbord/shared';
import { popupSignIn, randomString } from '../accounts';

const env = import.meta.env as Record<string, string | undefined>;

/** Base URL of the API, or null when GitHub sync is not set up in this build. */
export const GITHUB_API =
  (env.VITE_GITHUB_API_URL || env.VITE_API_URL || '').replace(/\/+$/, '') || null;

/**
 * Opaque session id handed out by the API after sign-in. Kept in localStorage
 * so every tab shares the sign-in; it is useless without the API's database.
 */
const SESSION_KEY = 'devbord:github:session';

export function githubSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function setSession(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: the sign-in lasts until the page reloads.
  }
}

export class GithubApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!GITHUB_API) throw new GithubApiError(503, 'GitHub no está configurado en Devbord.');
  const session = githubSession();
  if (!session) throw new GithubApiError(401, 'Conecta tu cuenta de GitHub.');
  let res: Response;
  try {
    res = await fetch(`${GITHUB_API}/api/github${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new GithubApiError(0, 'No hay conexión con el servidor de Devbord.');
  }
  if (res.status === 401) setSession(null);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new GithubApiError(res.status, err?.error?.message ?? `Error ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export interface GithubProjectSummary {
  id: string;
  number: number;
  title: string;
  url: string;
  owner: string;
}

export const githubApi = {
  /** Signs in through the GitHub App (popup) and keeps the session id. */
  async signIn() {
    if (!GITHUB_API) throw new GithubApiError(503, 'GitHub no está configurado en Devbord.');
    const state = randomString(16);
    const params = await popupSignIn(
      `${GITHUB_API}/api/github/login?state=${encodeURIComponent(state)}`,
      state,
    );
    const session = params.get('devbord_session');
    if (!session) throw new GithubApiError(401, 'GitHub no devolvió la sesión.');
    setSession(session);
  },
  async signOut() {
    await call('POST', '/logout').catch(() => undefined);
    setSession(null);
  },
  me: () => call<{ login: string; avatarUrl: string }>('GET', '/me'),
  projects: () =>
    call<{ projects: GithubProjectSummary[]; installUrl: string }>('GET', '/projects'),
  board: (projectId: string) =>
    call<Board>('GET', `/projects/${encodeURIComponent(projectId)}/board`),
  op: (projectId: string, op: GithubOp) =>
    call<{ board: Board }>('POST', `/projects/${encodeURIComponent(projectId)}/ops`, op),
};

/**
 * Listens to "changed" notices of a Project (Server-Sent Events read with
 * fetch, so the session header can be sent). Reconnects with backoff until
 * stopped. `onState` reports whether the stream is live.
 */
export function watchProject(
  projectId: string,
  onChange: () => void,
  onState: (live: boolean) => void,
): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retry = 1_000;

  const connect = async () => {
    while (!stopped) {
      controller = new AbortController();
      try {
        const session = githubSession();
        if (!GITHUB_API || !session) return;
        const res = await fetch(
          `${GITHUB_API}/api/github/projects/${encodeURIComponent(projectId)}/events`,
          { headers: { Authorization: `Bearer ${session}` }, signal: controller.signal },
        );
        if (res.status === 401) {
          setSession(null);
          onState(false);
          return;
        }
        if (!res.ok || !res.body) throw new Error(`events ${res.status}`);
        onState(true);
        retry = 1_000;
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          // Events end with a blank line; comments (": ping") keep the line alive.
          let end: number;
          while ((end = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (/^event: changed$/m.test(chunk)) onChange();
          }
        }
      } catch {
        if (stopped) return;
      }
      onState(false);
      await new Promise((r) => setTimeout(r, retry));
      retry = Math.min(retry * 2, 30_000);
    }
  };
  void connect();
  return () => {
    stopped = true;
    controller?.abort();
  };
}
