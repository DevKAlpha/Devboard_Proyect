/**
 * Runtime configuration, read once from environment variables.
 * Every value has a safe local default so `npm run dev:api` works out of the box.
 */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  /**
   * Comma-separated list of allowed browser origins (the web app).
   * Example: "https://user.github.io,http://localhost:5173".
   */
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
} as const;
