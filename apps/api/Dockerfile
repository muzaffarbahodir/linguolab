# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile для NestJS API в pnpm monorepo.
# Использует `pnpm deploy --prod` для создания standalone bundle.

# ---------- base ----------
FROM node:22-alpine AS base
RUN apk add --no-cache openssl tini
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
WORKDIR /app

# ---------- builder ----------
FROM base AS builder

# Workspace files (для resolve зависимостей)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/

# Установка всех зависимостей (включая dev — нужно для tsc + prisma)
RUN pnpm install --frozen-lockfile

# Копируем исходники + сборка
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN pnpm prisma generate
RUN pnpm build

# pnpm deploy создаёт автономный bundle в /deploy:
# - package.json (только prod-зависимости)
# - node_modules/ (с prod-deps)
# - все non-ignored файлы из apps/api (включая dist/, prisma/)
WORKDIR /app
RUN pnpm --filter @linguolab/api deploy --prod --legacy /deploy

# prisma теперь в dependencies → pnpm deploy --prod включит его в /deploy/node_modules

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

# Копируем готовый bundle
COPY --from=builder /deploy ./

# Генерируем Prisma-клиент в образ НА СБОРКЕ (прямой бинарь, без pnpm/сети).
# Раньше generate был в CMD → каждый старт дёргал pnpm через corepack,
# который качает pnpm из сети; при сетевом сбое `pnpm install` падал (exit 1)
# и контейнер уходил в рестарт → окна 502. Теперь рантайм не зависит от pnpm.
RUN node_modules/.bin/prisma generate

ENTRYPOINT ["/sbin/tini", "--"]

# При старте: миграция (идемпотентна) + запуск. Прямой бинарь prisma — без pnpm.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
