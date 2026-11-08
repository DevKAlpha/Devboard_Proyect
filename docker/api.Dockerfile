# syntax=docker/dockerfile:1
# Devbord API: bundle to a single file with esbuild, run it on a slim Node image.

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @devbord/api --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @devbord/api

# ── Runtime stage ─────────────────────────────────────────────────────────────
# The bundle includes all dependencies, so no node_modules are needed at runtime.
FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/server.cjs"]
