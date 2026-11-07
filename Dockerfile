# syntax=docker/dockerfile:1

# Multi-stage build: dev dependencies and source code never reach the final image.

ARG NODE_VERSION=26

# ─── Base ────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# ─── All dependencies (needed to build) ──────────────────────────────────────
FROM base AS deps
# Copy only what `npm ci` needs, so this layer is cached until dependencies change.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# HUSKY=0 skips git hooks setup; `postinstall` generates the Prisma client.
RUN HUSKY=0 npm ci

# ─── Build ───────────────────────────────────────────────────────────────────
# Also used by the `migrate` service in docker-compose (it has the Prisma CLI and tsx).
FROM deps AS build
COPY . .
RUN npm run build

# ─── Production dependencies only ────────────────────────────────────────────
FROM base AS prod-deps
COPY package.json package-lock.json ./
# No scripts needed: the Prisma client is bundled into dist/, argon2 ships prebuilt binaries.
RUN npm ci --omit=dev --ignore-scripts

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

# Never run as root.
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

# Run node directly (not via npm) so SIGTERM reaches the app for graceful shutdown.
CMD ["node", "--enable-source-maps", "dist/server.js"]
