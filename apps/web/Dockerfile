# ─── Stage 1: Builder ─────────────────────────────────────────────────────────

FROM node:20-alpine AS builder

RUN npm install -g pnpm@8

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY apps/web ./apps/web

# Build types first
RUN cd packages/types && pnpm exec tsc

# Next.js build — outputs to apps/web/.next
RUN cd apps/web && pnpm exec next build

# ─── Stage 2: Production ──────────────────────────────────────────────────────

FROM node:20-alpine AS production

RUN npm install -g pnpm@8
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --prod

# Copy Next.js standalone output
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/packages/types/dist ./packages/types/dist

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["pnpm", "--filter", "@chatbot/web", "start"]