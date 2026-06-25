#!/usr/bin/env bash
# deploy-web.sh — быстрый деплой TWA без CI/CD
# Использование: ./deploy-web.sh
# Требует: SSH доступ к серверу (root@vmi3256477)

set -e

SERVER="root@79.143.176.220"
REMOTE_PATH="/opt/linguolab/web/dist/"

echo "🔨 Сборка TWA..."
pnpm --filter @linguolab/web build

echo "📤 Деплой на сервер (очистка старых файлов)..."
ssh "$SERVER" "rm -rf $REMOTE_PATH* && mkdir -p $REMOTE_PATH"

echo "📤 Копирование файлов..."
scp -r apps/web/dist/. "$SERVER:$REMOTE_PATH"

echo "✅ Готово! Открой TWA и обнови страницу."
