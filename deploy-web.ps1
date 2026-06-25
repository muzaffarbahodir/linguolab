# deploy-web.ps1 — быстрый деплой TWA без CI/CD
# Использование: .\deploy-web.ps1
# Требует: OpenSSH + pnpm

$Server = "root@vmi3256477"
$RemotePath = "/opt/linguolab/web/dist/"
$LocalDist = "apps/web/dist/"

Write-Host "🔨 Сборка TWA..." -ForegroundColor Cyan
pnpm --filter @linguolab/web build
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Сборка провалилась" -ForegroundColor Red; exit 1 }

Write-Host "📤 Деплой на сервер..." -ForegroundColor Cyan
# rsync через OpenSSH (встроен в Windows 10+)
& scp -r "$LocalDist*" "${Server}:${RemotePath}"

# Альтернатива если scp не работает:
# rsync -avz --delete $LocalDist "${Server}:${RemotePath}"

Write-Host "✅ Готово! Открой TWA и обнови страницу." -ForegroundColor Green
