# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile для Next.js portal (student + teacher cabinet).
# Port 3002.

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/portal/package.json apps/portal/
RUN pnpm install --frozen-lockfile --filter @linguolab/portal...

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/portal/node_modules ./apps/portal/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/portal ./apps/portal

# Build-time env (не секреты — только публичные переменные)
ENV NEXT_TELEMETRY_DISABLED=1
# API_URL и NEXTAUTH_* передаются через --build-arg / env_file в compose
ARG API_URL=http://linguolab_api:3000
ARG NEXTAUTH_URL=https://portal-linguolab.muzaffarbahodir.uz
ENV API_URL=${API_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}

WORKDIR /app/apps/portal
RUN pnpm build

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Next standalone — минимальный bundle с server.js
COPY --from=builder /app/apps/portal/.next/standalone ./
COPY --from=builder /app/apps/portal/.next/static ./apps/portal/.next/static
COPY --from=builder /app/apps/portal/public ./apps/portal/public

WORKDIR /app/apps/portal

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3002/ || exit 1
