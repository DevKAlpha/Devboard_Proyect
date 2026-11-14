/**
 * Runtime configuration, read once from environment variables.
 * Every value has a safe local default so `npm run dev:api` works out of the box.
 */
const env = process.env;

/** `GITHUB_FAKE=1` serves an in-memory GitHub (local development and tests only). */
const fake = env.GITHUB_FAKE === '1';

export const config = {
  port: Number(env.PORT ?? 3000),
  /**
   * Comma-separated list of allowed browser origins (the web app).
   * Example: "https://user.github.io,http://localhost:5173".
   */
  corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  /**
   * GitHub App used to mirror boards with GitHub Projects (see docs/github.md).
   * Null when not configured: the /api/github routes answer 503.
   */
  github:
    fake ||
    (env.GITHUB_CLIENT_ID &&
      env.GITHUB_CLIENT_SECRET &&
      env.GITHUB_WEBHOOK_SECRET &&
      env.SESSION_SECRET &&
      env.WEB_URL)
      ? {
          fake,
          clientId: env.GITHUB_CLIENT_ID ?? 'fake-client',
          clientSecret: env.GITHUB_CLIENT_SECRET ?? 'fake-secret',
          webhookSecret: env.GITHUB_WEBHOOK_SECRET ?? 'fake-webhook-secret',
          /** Public name of the App, for the "install" link (github.com/apps/<slug>). */
          appSlug: env.GITHUB_APP_SLUG ?? 'devbord',
          /** Encrypts the GitHub tokens stored in the session database. */
          sessionSecret: env.SESSION_SECRET ?? 'fake-session-secret',
          /** Public URL of the web app, where sign-in popups land (…/oauth.html). */
          webUrl: (env.WEB_URL ?? 'http://localhost:5173').replace(/\/+$/, ''),
          /** Public URL of this API (GitHub sends the user back to <apiUrl>/api/github/callback). */
          apiUrl: (env.API_URL ?? `http://localhost:${env.PORT ?? 3000}`).replace(/\/+$/, ''),
          /** SQLite file for sessions; ":memory:" keeps nothing on disk. */
          database: fake ? ':memory:' : `${env.DATA_DIR ?? './data'}/devbord.db`,
          /** Seconds between checks of open Projects (personal Projects send no webhooks). */
          pollSeconds: Number(env.GITHUB_POLL_SECONDS ?? 30),
        }
      : null,
} as const;

export type GithubConfig = NonNullable<typeof config.github>;
