/**
 * Google and Microsoft accounts, signed in from the browser (no backend, so it
 * works on GitHub Pages). Both use OAuth 2.0 in a popup:
 *  - Google: token flow (Google web clients need a secret to swap a code).
 *  - Microsoft (Entra ID): authorization code + PKCE, the flow it recommends
 *    for single-page apps; the token endpoint accepts CORS for SPA redirects.
 *
 * The popup lands on `public/oauth.html`, which hands the URL back over a
 * BroadcastChannel: the providers' sign-in pages cut `window.opener` (COOP),
 * so the popup cannot be read directly.
 *
 * Tokens live in sessionStorage only (never in board data, never synced):
 * closing the tab signs out. Client ids come from the build environment
 * (VITE_GOOGLE_CLIENT_ID, VITE_MS_CLIENT_ID); see docs/integraciones.md.
 */
import { nextDay, type CalendarEvent } from './calendar';

export type AccountId = 'google' | 'microsoft';

interface AccountSpec {
  name: string;
  clientId: string | undefined;
  /** What the account is asked for: only writing calendar events, for now. */
  scope: string;
}

export const ACCOUNTS: Record<AccountId, AccountSpec> = {
  google: {
    name: 'Google',
    clientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || undefined,
    scope: 'https://www.googleapis.com/auth/calendar.events',
  },
  microsoft: {
    name: 'Microsoft',
    clientId: (import.meta.env.VITE_MS_CLIENT_ID as string | undefined) || undefined,
    scope: 'Calendars.ReadWrite',
  },
};

/** False when the build has no client id: the UI shows the account as "not set up". */
export const isConfigured = (id: AccountId) => Boolean(ACCOUNTS[id].clientId);

interface StoredToken {
  token: string;
  /** Epoch ms. */
  expiresAt: number;
}

const tokenKey = (id: AccountId) => `devbord:token:${id}`;

/** A valid access token, or null when signed out or expired. */
export function getToken(id: AccountId): string | null {
  try {
    const raw = sessionStorage.getItem(tokenKey(id));
    if (!raw) return null;
    const t = JSON.parse(raw) as StoredToken;
    // One minute of margin, so a request never starts with a dying token.
    if (typeof t.token !== 'string' || t.expiresAt - 60_000 < Date.now()) return null;
    return t.token;
  } catch {
    return null;
  }
}

function saveToken(id: AccountId, token: string, expiresIn: number) {
  const value: StoredToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
  try {
    sessionStorage.setItem(tokenKey(id), JSON.stringify(value));
  } catch {
    // Storage blocked: the account just will not stay signed in.
  }
}

export function signOut(id: AccountId) {
  const token = getToken(id);
  try {
    sessionStorage.removeItem(tokenKey(id));
  } catch {
    /* nothing stored */
  }
  // Google lets us revoke the grant; Microsoft tokens just expire (1 h).
  if (id === 'google' && token) {
    void fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
    }).catch(() => undefined);
  }
}

/** Where the providers send the popup back (must be registered in their consoles). */
export const redirectUri = () =>
  new URL(`${import.meta.env.BASE_URL}oauth.html`, window.location.origin).href;

const CHANNEL = 'devbord-oauth';

export const randomString = (bytes = 32) =>
  base64url(crypto.getRandomValues(new Uint8Array(bytes)));

function base64url(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Opens the sign-in popup and resolves with the parameters it came back with. */
export function popupSignIn(authUrl: string, state: string): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    const popup = window.open(authUrl, 'devbord-oauth', 'popup,width=520,height=680');
    if (!popup) {
      reject(new Error('El navegador bloqueó la ventana de inicio de sesión.'));
      return;
    }
    const channel = new BroadcastChannel(CHANNEL);
    const timer = window.setTimeout(
      () => finish(new Error('El inicio de sesión tardó demasiado.')),
      3 * 60_000,
    );
    const finish = (error: Error | null, params?: URLSearchParams) => {
      window.clearTimeout(timer);
      channel.close();
      if (error) reject(error);
      else resolve(params!);
    };
    channel.onmessage = (ev: MessageEvent) => {
      const url = new URL(String(ev.data));
      // Google answers in the hash (token flow), Microsoft in the query (code).
      const params = new URLSearchParams(url.hash.slice(1) || url.search.slice(1));
      if (params.get('state') !== state) return; // another sign-in, not ours
      const error = params.get('error_description') ?? params.get('error');
      finish(error ? new Error(error) : null, params);
    };
  });
}

/** Signs in with the provider's popup and keeps the token for this tab. */
export async function signIn(id: AccountId): Promise<void> {
  const { clientId, scope } = ACCOUNTS[id];
  if (!clientId) throw new Error('Esta conexión no está configurada.');
  const state = randomString(16);

  if (id === 'google') {
    const q = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(),
      response_type: 'token',
      scope,
      state,
      include_granted_scopes: 'true',
    });
    const params = await popupSignIn(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, state);
    saveToken(id, params.get('access_token') ?? '', Number(params.get('expires_in') ?? 3600));
    return;
  }

  const verifier = randomString(48);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    response_mode: 'query',
    scope,
    state,
    code_challenge: base64url(new Uint8Array(digest)),
    code_challenge_method: 'S256',
  });
  const base = 'https://login.microsoftonline.com/common/oauth2/v2.0';
  const params = await popupSignIn(`${base}/authorize?${q}`, state);
  const res = await fetch(`${base}/token`, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: params.get('code') ?? '',
      redirect_uri: redirectUri(),
      code_verifier: verifier,
      scope,
    }),
  });
  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description ?? 'Microsoft no entregó el acceso.');
  }
  saveToken(id, body.access_token, body.expires_in ?? 3600);
}

/** JSON POST with the account's token. A 401 signs out (the grant was revoked). */
async function post<T>(id: AccountId, url: string, payload: unknown): Promise<T> {
  const token = getToken(id);
  if (!token) throw new Error(`Conecta tu cuenta de ${ACCOUNTS[id].name} primero.`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    signOut(id);
    throw new Error('La sesión caducó. Vuelve a conectar la cuenta.');
  }
  if (!res.ok) throw new Error(`${ACCOUNTS[id].name} respondió ${res.status}.`);
  return (await res.json()) as T;
}

/**
 * Creates an all-day event in the account's main calendar and returns the
 * link to open it.
 */
export async function createCalendarEvent(id: AccountId, e: CalendarEvent): Promise<string> {
  if (id === 'google') {
    const event = await post<{ htmlLink: string }>(
      id,
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        summary: e.title,
        description: e.details,
        start: { date: e.date },
        end: { date: nextDay(e.date) },
      },
    );
    return event.htmlLink;
  }
  const event = await post<{ webLink: string }>(id, 'https://graph.microsoft.com/v1.0/me/events', {
    subject: e.title,
    body: { contentType: 'text', content: e.details },
    isAllDay: true,
    start: { dateTime: `${e.date}T00:00:00`, timeZone: 'UTC' },
    end: { dateTime: `${nextDay(e.date)}T00:00:00`, timeZone: 'UTC' },
  });
  return event.webLink;
}
