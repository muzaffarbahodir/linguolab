# syntax=docker/dockerfile:1.7
# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile --filter @linguolab/admin...

# ---------- builder ----------
FROM node:22-alpine AS builder
WORKDIR /app
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin ./apps/admin
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/apps/admin
RUN pnpm build

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Next standalone — минимальный bundle с server.js
COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

WORKDIR /app/apps/admin

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/ || exit 1
