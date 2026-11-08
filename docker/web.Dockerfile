# syntax=docker/dockerfile:1
# Devbord web: build the static SPA, then serve it with nginx.

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /repo

# Copy manifests first so `npm ci` is cached until dependencies change.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @devbord/web --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

# Served from the domain root by default. Set VITE_API_URL to use apps/api.
ARG VITE_BASE=/
ARG VITE_API_URL=
ENV VITE_BASE=$VITE_BASE VITE_API_URL=$VITE_API_URL
RUN npm run build -w @devbord/web

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM nginx:1.29-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
