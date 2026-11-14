/**
 * Thin GitHub HTTP client (GraphQL, REST and the OAuth token endpoint) over
 * `fetch`, injectable so tests and GITHUB_FAKE mode use an in-memory GitHub.
 */
import { HttpError } from '../middleware/errors';

export type Fetch = typeof fetch;

export interface TokenSet {
  accessToken: string;
  accessExpiresAt: number | null;
  refreshToken: string | null;
  refreshExpiresAt: number | null;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error_description?: string;
}

const API = 'https://api.github.com';
const HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'Devbord',
};

export class GithubClient {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly fetchFn: Fetch = fetch,
  ) {}

  /** Runs a GraphQL operation as the user. GitHub errors become HTTP 502 with its message. */
  async graphql<T>(token: string, query: string, variables: Record<string, unknown> = {}) {
    const res = await this.fetchFn(`${API}/graphql`, {
      method: 'POST',
      headers: { ...HEADERS, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 401) throw new HttpError(401, 'github_unauthorized', 'GitHub session ended');
    const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (!res.ok || body.errors?.length || !body.data) {
      throw new HttpError(
        502,
        'github_error',
        body.errors?.map((e) => e.message).join('; ') ?? `GitHub answered ${res.status}`,
      );
    }
    return body.data;
  }

  /** REST call as the user (used where GraphQL needs extra lookups, e.g. assignees by login). */
  async rest<T>(token: string, method: string, path: string, payload?: unknown): Promise<T> {
    const res = await this.fetchFn(`${API}${path}`, {
      method,
      headers: { ...HEADERS, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (res.status === 401) throw new HttpError(401, 'github_unauthorized', 'GitHub session ended');
    if (!res.ok) throw new HttpError(502, 'github_error', `GitHub answered ${res.status}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  /** OAuth: swaps the callback code (or a refresh token) for user tokens. */
  async token(
    grant: { code: string; redirectUri: string } | { refreshToken: string },
  ): Promise<TokenSet> {
    const params: Record<string, string> =
      'code' in grant
        ? { code: grant.code, redirect_uri: grant.redirectUri }
        : { refresh_token: grant.refreshToken, grant_type: 'refresh_token' };
    const res = await this.fetchFn('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        ...params,
      }),
    });
    const body = (await res.json()) as TokenResponse;
    if (!body.access_token) {
      throw new HttpError(401, 'github_oauth', body.error_description ?? 'GitHub sign-in failed');
    }
    const now = Date.now();
    return {
      accessToken: body.access_token,
      accessExpiresAt: body.expires_in ? now + body.expires_in * 1000 : null,
      refreshToken: body.refresh_token ?? null,
      refreshExpiresAt: body.refresh_token_expires_in
        ? now + body.refresh_token_expires_in * 1000
        : null,
    };
  }
}
