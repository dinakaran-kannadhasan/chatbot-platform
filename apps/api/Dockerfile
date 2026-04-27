# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
# We use a multi-stage build.
# Stage 1 installs ALL dependencies and compiles TypeScript.
# Stage 2 copies only the compiled output + production deps.
# Result: final image is ~60% smaller — no TypeScript compiler,
# no dev dependencies, no source files in production.

FROM node:20-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm@8

WORKDIR /app

# Copy workspace manifests first — Docker layer caching.
# If these files don't change, Docker reuses the cached
# node_modules layer and skips the slow pnpm install step.
# This makes rebuilds 10x faster when only source code changes.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY apps/api/package.json ./apps/api/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files AFTER installing dependencies
# Why after? If we copy source first, any source change
# invalidates the node_modules cache layer unnecessarily.
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY apps/api ./apps/api

# Build types package first (api depends on it)
RUN cd packages/types && pnpm exec tsc

# Build the API
RUN cd apps/api && pnpm exec tsc --project tsconfig.json

# ─── Stage 2: Production ──────────────────────────────────────────────────────

FROM node:20-alpine AS production

RUN npm install -g pnpm@8

# Create non-root user for security.
# Running as root in production is a security risk —
# if the app is compromised, the attacker has root access.
# A dedicated user limits the blast radius.
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy only what's needed to run the app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY apps/api/package.json ./apps/api/

# Install ONLY production dependencies — no devDependencies
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder stage
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Switch to non-root user
USER nodejs

EXPOSE 4000

# Healthcheck — Docker and Kubernetes use this to know
# if the container is healthy. If it fails 3 times,
# the container is restarted automatically.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "apps/api/dist/src/server.js"]