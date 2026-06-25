# LinguoLab — Дневник разработки

## Общий прогресс: 27+ этапов

Последнее обновление: 31.05.2026 (Этап 27 — Security & quality hardening: закрыты все 4 CRITICAL аудита)

Правила статусов:

- ✅ завершён — всё работает, код в `main`, коммит сделан
- 🔄 в процессе — текущий этап
- ⏳ в очереди — ещё не начат
- ❌ заблокирован — есть проблема, описать какая

---

## Git Workflow — правила

**Ветки:**

- `main` — защищённая, только через PR
- `develop` — интеграционная, сюда коммитим фичи

**Порядок работы:**

1. Разрабатываем на `develop`
2. Открываем PR: `develop → main`
3. После merge — GitHub Actions автоматически мержит `main → develop` (workflow `sync-develop.yml`)
4. Конфликтов при следующем PR не будет — develop всегда в sync с main

**Почему были конфликты раньше:**

Squash merge создаёт в `main` новый коммит которого нет в `develop`.
При следующем PR Git видит расхождение и требует resolve.
Решение: GHA workflow `.github/workflows/sync-develop.yml` делает `git merge origin/main` в develop
автоматически после каждого push в main.

**Если auto-sync упал** (редкий случай — настоящий конфликт):

```bash
git fetch origin
git merge origin/main --no-edit
# Resolve conflict вручную
git add .
git commit -m "chore: merge main into develop"
git push origin develop
```

---

## ✅ Этап 0.5 — Инфраструктура

Дата: 10.05.2026
Статус: ✅ Завершён
Коммиты в `main`:

- `cab8e6a` — `chore(repo): init monorepo with web/api/admin skeletons`
- PR #1 — `docs(readme): mark etap 0.5 ci/protection done`

### Что планировалось

Подготовить всю инфраструктуру до написания кода: домены через Cloudflare с SSL, R2 для файлов, существующий Docker-сервер с уже работающими проектами (`flowers.muzaffarbahodir.uz`, `tilloreferal.muzaffarbahodir.uz`), интеграция в существующий `main_nginx` без поломки чужих сайтов, изолированная БД, GitHub-репо с CI/CD, локальный монорепо со всеми конвенциями (Husky, commitlint, ESLint, Prettier).

### Что сделано (подробно)

**Cloudflare:**

- Зона `muzaffarbahodir.uz` уже была на CF
- Добавили 3 A-записи на IP `79.143.176.220` (DNS-only / серое облако пока)
  - `app-linguolab.muzaffarbahodir.uz`
  - `api-linguolab.muzaffarbahodir.uz`
  - `admin-linguolab.muzaffarbahodir.uz`
- Создали Origin Certificate wildcard `*.linguolab.muzaffarbahodir.uz` сроком на 15 лет (RSA 2048), действует с 10.05.2026 до 06.05.2041
- SSL/TLS режим — Full (strict)
- Создали R2 bucket `linguolab-files` (регион WEUR)
- Привязали custom domain `cdn-linguolab.muzaffarbahodir.uz` к bucket (оранжевое облако обязательно для R2 custom domain)
- CORS настроен: разрешены `GET/PUT/POST/HEAD` с `https://app-linguolab.muzaffarbahodir.uz`
- API-токен `linguolab-r2` создан с правами `Object Read & Write` только на bucket `linguolab-files`

**Сервер (Ubuntu 22.04, IP `79.143.176.220`):**

- Создали структуру `/opt/linguolab/{nginx/conf.d, certs, web/dist, backups, compose}` с правами `chmod 700` на `certs/`
- Загрузили Origin Cert: `/opt/linguolab/certs/origin.pem` (644) + `/opt/linguolab/certs/origin.key` (600)
- Проверили валидность сертификата и пары ключ-сертификат: `openssl x509` + сравнение публичных ключей → MATCH OK
- Сделали бэкап `/opt/nginx/nginx.conf` и `/opt/nginx/docker-compose.yml` перед модификацией
- Написали 3 vhost-конфига (`app/api/admin.linguolab.conf`) с Origin Cert и lazy DNS resolution через `set $upstream` для api/admin (чтобы nginx не падал, когда upstream-контейнеры ещё не подняты)
- Создали placeholder `index.html` на фиолетовом фоне для `app.linguolab`
- Добавили в `/opt/nginx/nginx.conf` строку `include /etc/nginx/conf.d/linguolab/*.conf;` через `sed`
- Добавили 3 новых bind-mount в compose `main_nginx`:
  - `/opt/linguolab/nginx/conf.d → /etc/nginx/conf.d/linguolab:ro`
  - `/opt/linguolab/certs → /etc/nginx/certs/linguolab:ro`
  - `/opt/linguolab/web/dist → /usr/share/nginx/linguolab-web:ro`
- Пересобрали `main_nginx` через `docker compose up -d`
- Запустили `linguolab_postgres` (postgres:16-alpine) + `linguolab_redis` (redis:7-alpine) в новой сети `linguolab_internal` (отдельной от `shared_web`), порты наружу не опубликованы — внутренний доступ только по имени контейнера
- Сгенерили сильные пароли для postgres и redis через `openssl rand -base64 48`
- Сохранили пароли в `/opt/linguolab/compose/.env` (chmod 600)

**GitHub:**

- Создан публичный репо `artsoftmuzaffarkhon/linguolab`
- Ветки: `main` (защищена), `develop` (для интеграции)
- Branch protection на `main`: PR-only, required status check `Lint, Format, Typecheck, Test`, no force push
- `gh auth login` через браузер (ключи в Windows Credential Manager)

**Локальный монорепо `linguolab/`:**

- pnpm 11.0.9 + Turborepo 2.9.12 + TypeScript 5.9.3
- Workspace через `pnpm-workspace.yaml` (`apps/*` + `packages/*`)
- Husky 9.1.7 + commitlint 19.8.1 + lint-staged 15.5.2
- Prettier 3.8.3 + `prettier-plugin-tailwindcss` 0.6.14
- ESLint strict TS — конфиг будет добавлен в Этапе 1 когда появятся пакеты
- Conventional Commits enforced через `commitlint.config.js`
- 4 коммита, 2 PR (PR #1 смержен в `main`)
- CI workflow `Lint, Format, Typecheck, Test` запускается на `push`/`pull_request` в `main` и `develop` — все запуски зелёные (16-21 сек)

### Файлы созданы / изменены

**В репозитории `linguolab/`:**

- `.editorconfig`
- `.env.example` (полный список env-переменных)
- `.github/workflows/ci.yml`
- `.gitignore`
- `.husky/pre-commit` + `.husky/commit-msg`
- `.nvmrc`
- `.prettierignore` + `.prettierrc.json`
- `apps/.gitkeep`, `packages/.gitkeep`, `prisma/.gitkeep`
- `commitlint.config.js`
- `docs/PLAN.md`, `docs/PLAN_FINAL.md` (перенесены из родительской папки)
- `infra/nginx/conf.d/app.linguolab.conf`
- `infra/nginx/conf.d/api.linguolab.conf`
- `infra/nginx/conf.d/admin.linguolab.conf`
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `README.md` (RU + TODO-список этапов)
- `tsconfig.base.json`
- `turbo.json`
- `project_progress.md` (этот файл)

**На сервере:**

- `/opt/linguolab/nginx/conf.d/{app,api,admin}.linguolab.conf` (созданы)
- `/opt/linguolab/certs/origin.pem` + `origin.key` (загружены через scp)
- `/opt/linguolab/web/dist/index.html` (placeholder)
- `/opt/linguolab/compose/docker-compose.yml` (postgres + redis)
- `/opt/linguolab/compose/.env` (пароли)
- `/opt/nginx/nginx.conf` (добавлена строка `include`)
- `/opt/nginx/docker-compose.yml` (3 новых volume-mount)
- `/opt/nginx/nginx.conf.bak.2026-05-10-182250` (бэкап)
- `/opt/nginx/docker-compose.yml.bak.*` (бэкап)

### Команды выполнены на сервере (ключевые)

```bash
mkdir -p /opt/linguolab/{nginx/conf.d,certs,web/dist,backups,compose}
chmod 700 /opt/linguolab/certs
chmod 600 /opt/linguolab/certs/origin.key
sed -i '/upstream flowershop_backend/a\    include /etc/nginx/conf.d/linguolab/*.conf;' /opt/nginx/nginx.conf
docker compose -f /opt/nginx/docker-compose.yml up -d
docker compose -f /opt/linguolab/compose/docker-compose.yml up -d
```

Результаты:

- `linguolab_postgres` — Up (healthy), PostgreSQL 16.13, БД `linguolab` создана
- `linguolab_redis` — Up (healthy), Redis 7.4.8
- `main_nginx` пересобран без даунтайма для соседей
- `nginx -t` — `syntax is ok` + `test is successful`
- HTTPS-тесты на сервере (`curl -k --resolve`):
  - `app-linguolab.muzaffarbahodir.uz` → `200 OK` (placeholder)
  - `api-linguolab.muzaffarbahodir.uz` → `502 Bad Gateway` (ожидаемо — нет upstream)
  - `admin-linguolab.muzaffarbahodir.uz` → `502 Bad Gateway` (ожидаемо)
  - `flowers.muzaffarbahodir.uz` → `200 OK` (соседний проект не сломан)

### Проблемы и решения

- **`jq` не установлен на сервере** — использовали `python3 -m json.tool` для парсинга `docker inspect` вывода. Решение работающее, ставить `jq` не стали (лишняя зависимость).
- **Warning `version is obsolete` в compose** — Docker Compose v5+ игнорирует поле `version`. В нашем `linguolab` compose оставили на будущее (уберём при следующей правке), в `main_nginx` оставили как было — не наш файл по сути.
- **LF/CRLF warnings от git на Windows** — нормальное поведение `core.autocrlf=true` (по умолчанию в Git for Windows). Файлы хранятся с LF в репо, в worktree CRLF. Если нужно — добавим `.gitattributes` с `* text=auto eol=lf` позже.
- **Утечка GitHub PAT в чате** — токен `ghp_6EMBK...` был случайно вставлен в чат. Немедленно отозван через https://github.com/settings/tokens. Дальше используем `gh auth login` через браузер — токен в Windows Credential Manager, не светится в чате/терминале.
- **Утечка Telegram Bot Token в чате** — токен `8183510176:AAF0...` для `@linguolab_bot` тоже попал в чат. Будет revoked через `@BotFather` `/revoke` перед стартом Этапа 1 (до того как используется в коде).

### Архитектурные решения

- **Не поднимаем второй nginx** — встраиваемся в существующий `main_nginx` через bind-mount conf.d. Проще, меньше точек отказа, не конфликтуем за порты 80/443.
- **Две Docker-сети**: `shared_web` (external, существующая) — для будущих `linguolab_api`/`linguolab_admin`, чтобы `main_nginx` мог проксировать по имени контейнера. `linguolab_internal` (новая) — для `linguolab_postgres`/`linguolab_redis`, наружу не публикуем.
- **Lazy DNS resolution в nginx** через `set $upstream http://...; proxy_pass $upstream;` — этот трюк взят из существующего `tilloreferal` конфига. Nginx не падает при старте, если upstream-контейнер ещё не поднят — отдаёт 502 пока не появится.
- **Origin Certificate wildcard на 15 лет** — экономит время на регенерации, валиден до 2041. Subject CN общий (`CloudFlare Origin Certificate`), wildcard hostname — в SAN.
- **Lock-step с `docker-proxy`** — порты 80/443 уже занимает `main_nginx`, мы их не двигаем.
- **CI без deploy-workflow на этом этапе** — деплой добавим в Этапе 1, когда появятся реальные приложения для деплоя.

### Что отложили

- **Включить оранжевое облако Cloudflare** на `app/api/admin` записях. Сейчас серое (DNS-only), потому что Origin Cert валиден только когда CF проксирует — иначе браузер выдаст ошибку доверия. Включим в Этапе 1, когда будут реальные сервисы для теста.
- **Deploy workflows** (`deploy-web.yml`, `deploy-api.yml`, `deploy-admin.yml`) — добавим после Этапа 1, когда появится что деплоить.
- **Firewall (ufw)** — пока `inactive`. Включим после стабилизации стека (`ufw allow 22,80,443/tcp`).
- **SSH-ключ вместо пароля** — рекомендация. Сейчас деплой будет через SSH password. Можно перевести на ключ позже без потери совместимости.
- **`.gitattributes`** — для нормализации EOL в монорепо. Добавим если будут реальные конфликты CRLF.
- **Бэкапы Postgres** в R2 — cron на сервере (daily dump → R2 weekly sync). Отложено до конца Этапа 1.

### Следующий этап

**Этап 1 — Скелет приложений:**

- `apps/web/` — Vite + React + TS + Tailwind + `@twa-dev/sdk` + React Router + 4 пустые страницы (Home/Schedule/Courses/Profile)
- `apps/api/` — NestJS + Prisma init + первая миграция (users, languages)
- `apps/admin/` — Next.js skeleton
- `WebApp.ready()` + `WebApp.expand()` + theme через CSS-vars
- BottomNav (4 пункта, иконки SVG)
- Включаем оранжевое облако CF
- Добавляем `deploy-*.yml` workflows

---

## ✅ Этап 1 — Скелет приложений

Дата: 10–11.05.2026
Статус: ✅ Завершён
Коммиты в `main`:

- PR #3 — `feat: scaffold apps (web/api/admin) + deploy workflows`
- PR #4 — `fix(ci): skip husky in Docker prod stage` (HUSKY=0 + prepare fallback)
- PR #5 — `fix(api): Dockerfile pnpm deploy` (monorepo-safe build)
- PR #6 — `refactor: migrate to dash-format hostnames + Этап 1 закрыт`

### Что планировалось

Skeleton трёх приложений (TWA / API / Admin) + полностью рабочий CI/CD пайплайн с авто-деплоем на VPS через Docker Compose + Cloudflare orange-cloud proxy + R2 storage.

### Что сделано (подробно)

**`apps/web/` — TWA (React + Vite):**

- Vite 5.4 + React 18 + TypeScript 5.9 + Tailwind 3.4
- `@twa-dev/sdk` — `WebApp.ready()`, `WebApp.expand()`, theme через CSS-vars `var(--tg-theme-*)`
- React Router v6 + 4 страницы placeholder (Home / Schedule / Courses / Profile)
- BottomNav (4 пункта, SVG-иконки, фиксированный нижний бар, safe-area iOS)
- TanStack Query + Zustand (in-memory, без persist)
- ESLint flat config + Prettier с plugin-tailwindcss
- Build → 247 KB JS (75 KB gzip), 6.7 KB CSS, 95 модулей

**`apps/api/` — NestJS:**

- NestJS 10.4 + Prisma 5.22 + PostgreSQL 16 + Redis 7
- `/health` endpoint (без префикса `/api/v1`)
- Prisma schema: модели `User` (telegram_user_id, role, token_version и т.д.) + `Language` (справочник)
- Seed-файл с 5 языками (en/es/fr/zh/uz)
- ConfigModule с глобальной доступностью
- `trust proxy` (для CF + nginx)
- Multi-stage Dockerfile через `pnpm deploy --prod` (monorepo-safe)
- `tini` как PID 1 для корректного SIGTERM
- HEALTHCHECK в Docker
- Build через `tsc -p tsconfig.build.json` напрямую (обошли баг `nest build` который собирал только `main.ts`)

**`apps/admin/` — Next.js:**

- Next.js 14.2 (App Router) + Tailwind + TypeScript
- 3 страницы: `/` (placeholder dashboard), `/login` (заглушка), `/_not-found`
- `output: 'standalone'` (условный — на Windows local skip из-за symlink-permissions)
- Build → 8.87 KB main, 96 KB First Load JS
- Multi-stage Dockerfile через Next standalone bundle

**CI/CD (GitHub Actions):**

- `.github/workflows/ci.yml` — lint/format/typecheck/test на каждый push в main/develop
- `.github/workflows/deploy-web.yml` — `pnpm build` → `rsync apps/web/dist/` → VPS via SSH
- `.github/workflows/deploy-api.yml` — Docker build → push GHCR → SSH → `docker compose pull/up`
- `.github/workflows/deploy-admin.yml` — то же для admin
- Триггеры: push в `main` (path-filtered) + workflow_dispatch
- GHCR пакеты public (для server pull без auth)
- 4 GitHub Secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`
- SSH ed25519 ключ (без passphrase), публичный на сервере, приватный в Secret

**Migration на dash-format hostnames:**

Изначально хосты были `XXX.linguolab.muzaffarbahodir.uz` (2 уровня после корня), но CF Free Universal SSL покрывает только `*.muzaffarbahodir.uz` (1 уровень). Subdomain Setup в CF Free больше недоступен. Перешли на:

- `app-linguolab.muzaffarbahodir.uz` (TWA)
- `api-linguolab.muzaffarbahodir.uz` (API)
- `admin-linguolab.muzaffarbahodir.uz` (Admin)
- `cdn-linguolab.muzaffarbahodir.uz` (R2)

Все эти хосты — subdomain первого уровня, покрываются Universal Cert автоматом. Бесплатно.

**Сервер (изменения в Этапе 1):**

- В `/opt/linguolab/compose/.env` сгенерены JWT_SECRET, JWT_REFRESH_SECRET (`openssl rand -hex 64`), TELEGRAM_WEBHOOK_SECRET (`openssl rand -hex 32`)
- `/opt/linguolab/compose/docker-compose.yml` расширен: добавлены `linguolab_api` и `linguolab_admin` (image из GHCR), подключены к `shared_web` (для nginx) + `linguolab_internal` (для БД/Redis)
- depends_on с `condition: service_healthy` для Postgres/Redis
- `/opt/linguolab/nginx/conf.d/*.conf` — server_name обновлён на dash-format
- `main_nginx` reload без даунтайма для соседей (flowers, tilloreferal)
- Origin Cert wildcard покрывает оба формата через SAN `*.muzaffarbahodir.uz` (не нужно было пересоздавать)

**Cloudflare (изменения в Этапе 1):**

- 3 новых A-записи (`app-linguolab`, `api-linguolab`, `admin-linguolab`) → 79.143.176.220, **Proxied**
- R2 custom domain `cdn-linguolab.muzaffarbahodir.uz` создан, старый `cdn.linguolab` disconnect
- CORS Policy R2 обновлён на `https://app-linguolab.muzaffarbahodir.uz`
- Удалены старые A-записи `app.linguolab`, `api.linguolab`, `admin.linguolab`

**Финальные публичные URL (все HTTP/2 200 через CF):**

- `https://app-linguolab.muzaffarbahodir.uz` — TWA placeholder + 4 page routes
- `https://api-linguolab.muzaffarbahodir.uz/health` — NestJS JSON `{"status":"ok",...}`
- `https://admin-linguolab.muzaffarbahodir.uz` — Next.js dashboard placeholder
- `https://cdn-linguolab.muzaffarbahodir.uz` — R2 404 (пустой bucket, ожидаемо)

### Файлы созданы / изменены (репо)

```
apps/web/                       — полный skeleton (package.json, vite.config, tailwind, src/*)
apps/api/                       — полный skeleton (NestJS + Prisma + Dockerfile + seed)
apps/admin/                     — полный skeleton (Next.js + Dockerfile)
.github/workflows/ci.yml        — расширен
.github/workflows/deploy-{web,api,admin}.yml — новые
infra/nginx/conf.d/*.conf       — server_name переписан на dash-format
.env.example                    — обновлён
pnpm-workspace.yaml             — добавлено onlyBuiltDependencies + allowBuilds
package.json                    — pnpm.onlyBuiltDependencies + husky `|| true`
.gitignore                      — debug-логи + vite.config артефакты
README.md                       — TODO-чеклист обновлён
project_progress.md             — этот файл (закрытие Этапа 1)
docs/PLAN.md + PLAN_FINAL.md    — URL обновлены на dash-format
```

### Команды выполнены на сервере (ключевые)

```bash
# Создание .env с секретами
JWT=$(openssl rand -hex 64) && ...

# Compose обновлён с api+admin сервисами
docker compose -f /opt/linguolab/compose/docker-compose.yml up -d

# Миграция на dash-format (сед-замены в nginx confs + .env)
sed -i 's/app\.linguolab\.../app-linguolab\.../g' /opt/linguolab/nginx/conf.d/app.linguolab.conf
docker exec main_nginx nginx -s reload
```

### Проблемы и решения

- **pnpm 11 IGNORED_BUILDS** — pnpm 11 блокирует post-install скрипты по умолчанию. Решено через `pnpm approve-builds` (интерактивно) + `onlyBuiltDependencies` в `pnpm-workspace.yaml` + дубль в `package.json` `pnpm.onlyBuiltDependencies`.
- **Husky падает в Docker prod stage** — husky-binary в devDeps, в `pnpm install --prod` не ставится → `prepare` хук падает. Решено: `"prepare": "husky || true"` + `ENV HUSKY=0` в Dockerfile.
- **`nest build` собирал только `main.ts`** — почему — не выяснилось, но `tsc -p tsconfig.build.json` напрямую собирает все 4 файла корректно. Скрипт `build` переписан.
- **Next.js standalone падает на Windows** — `EPERM symlink` на pnpm-hoisted node_modules. Решено условно: `output: process.platform === 'win32' ? undefined : 'standalone'`.
- **Prisma client не копировался в runtime stage** — pnpm hoist в monorepo: deps в `/app/node_modules/.pnpm/`, не в `/app/apps/api/node_modules/`. Решено через `pnpm deploy --prod /deploy` pattern + явный cp `.prisma` и `@prisma`.
- **CF Universal SSL не покрывает 2-уровневый wildcard** — `*.muzaffarbahodir.uz` НЕ покрывает `api.linguolab.muzaffarbahodir.uz`. CF Free Subdomain Setup недоступен. ACM $10/мес отвергнут. Решение: dash-format хосты `*-linguolab.muzaffarbahodir.uz` (subdomain первого уровня).
- **GHCR packages private по умолчанию** — после первого build образ в GHCR private, server pull падает. Решено: вручную сделали public через UI (Danger Zone).
- **`docker exec` команда с `--filter --format` в одинарных кавычках через SSH+PS** — PowerShell не передаёт правильно. Решение: каждый ssh-вызов на отдельной строке.
- **GitHub PAT случайно вставлен в чат** — токен скомпрометирован, отозван через GH Settings. Дальше — `gh auth login` через браузер (без PAT в чате).
- **Telegram Bot Token случайно вставлен в чат** — revoked через @BotFather `/revoke`. Новый токен сохранён локально, в чат не вставлять.

### Архитектурные решения

- **dash-format hostnames** вместо subdomain-zone — компромисс между free Universal SSL и минимумом изменений (vs ACM $10/мес).
- **`pnpm deploy --prod`** для Docker — стандартный pattern для pnpm monorepo, изолирует prod-bundle.
- **`tsc -p tsconfig.build.json` напрямую** вместо `nest build` — обход бага nest CLI который собирал только entry-point.
- **Origin Cert SAN включает `*.muzaffarbahodir.uz`** — при создании CF cert wildcard расширяет до multiple SANs, что покрыло оба формата хостов без перевыпуска.
- **Двойная Docker-сеть** — `shared_web` (для nginx) + `linguolab_internal` (для БД/Redis) — изолирует БД от внешнего nginx без потери связи api/admin с обоими.
- **GitHub Secrets для SSH** — приватный ключ ed25519 (без passphrase) + known_hosts из самого сервера (не через `ssh-keyscan` который баговал на Win OpenSSH 9.5).

### Что отложили

- **Firewall (ufw)** — всё ещё inactive. Включим после Этапа 2 (`ufw allow 22,80,443/tcp`).
- **SSH-ключ как единственный метод** — пароль root всё ещё работает. Отключим (`PasswordAuthentication no`) после стабилизации.
- **Бэкапы Postgres** в R2 — cron на сервере. Отложено до Этапа 11.5 (когда будут реальные данные).
- **`prisma migrate deploy`** на старте API — пока миграций нет, runs `No migration found`. Реальные миграции = Этап 2+.
- **Origin Cert на dash-form (более узкий scope)** — старый wildcard `*.muzaffarbahodir.uz` пока работает. Можно перевыпустить только для 4 dash-хостов когда появится время.
- **CF WAF rules + rate limiting** — для `/auth/*` и `/payments/*/webhook`. Этап 2+.

### Следующий этап

**Этап 2 — Auth через Telegram initData:**

- `TelegramInitDataValidator` (HMAC-SHA256, auth_date ≤24ч)
- `POST /auth/telegram/init` — верификация + JWT issuance (access 15m + refresh 30d)
- `POST /auth/refresh` — обмен refresh на новую пару
- `POST /auth/admin/login` — email+password для роли ADMIN+ (NextAuth credentials)
- Гварды: `JwtAuthGuard`, `RolesGuard`, `TelegramInitDataGuard`, `AdminGuard`, `SuperAdminOnlyGuard`
- TWA: `/auth/telegram/init` при mount `App.tsx`, токен в zustand in-memory, axios interceptor для 401 → retry init
- Миграция БД: расширения `User` (если нужно), новые поля для admin auth

---

## ✅ Этап 2 — Auth через Telegram initData

Дата: 12.05.2026
Статус: ✅ Завершён
Коммиты в `main`:

- `bb66d5a` — `feat(auth): Telegram initData verification + JWT + Redis refresh + Admin NextAuth`
- PR #8 — `fix(api): copy prisma client from hoisted root node_modules in Dockerfile`
- PR #9 — `fix(api): move prisma to deps + prisma generate in CMD startup`
- PR #10 — `fix(docker): use 127.0.0.1 in healthcheck (localhost = ::1 in Alpine)`
- PR #11 — `fix(admin): add HOSTNAME=0.0.0.0 for Next.js healthcheck binding`
- `chore(infra): add docker-compose.yml to repo`

### Что планировалось

`TelegramInitDataValidator` (HMAC-SHA256, auth_date ≤24ч), JWT access+refresh, Redis rotation chain, гварды, TWA auto-init, Admin NextAuth с email+password.

### Что сделано (подробно)

**`apps/api/` — Auth модуль:**

- `TelegramInitDataValidator` — полная реализация алгоритма по документации Telegram:
  - HMAC-SHA256 с `secret_key = HMAC("WebAppData", bot_token)` (вычисляется один раз в конструкторе)
  - `timingSafeEqual` для сравнения hash (защита от timing attacks)
  - `auth_date` freshness check ≤86400 секунд (24ч)
  - BigInt(id) для Telegram user_id (может превышать `Number.MAX_SAFE_INTEGER`)
- `AuthController` — 4 endpoints, все `@Public()` кроме `/logout`:
  - `POST /auth/telegram/init` — TWA авторизация
  - `POST /auth/admin/login` — email+password для MANAGER/ADMIN/SUPER_ADMIN
  - `POST /auth/refresh` — обмен refresh → новая пара
  - `POST /auth/logout` — отзыв refresh токена
- `AuthService` — три флоу:
  - `telegramInit` → validate HMAC → upsert user → issueTokenPair
  - `adminLogin` → findUnique → роль check → `bcrypt.compare` → issueTokenPair
  - `refresh` → verify JWT → Redis GET → tv check → del old → issue new с тем же familyId
  - Reuse detection: токен уже нет в Redis → `revokeFamily` (SCAN `refresh:*` → del всех userId)
- JWT rotation chain в Redis:
  - Key: `refresh:<jti>` → Value: `{userId, tv, familyId}` → TTL: 30d
  - Новый familyId при первом логине, тот же familyId при rotation
  - `token_version` (tv) в payload: при смене роли инкрементируется → все старые токены невалидны
- `JwtStrategy` — validate проверяет `user.token_version === payload.tv` при каждом запросе
- `JwtAuthGuard` — глобальный APP_GUARD с `@Public()` opt-out (`IS_PUBLIC_KEY` reflector)
- `RolesGuard`, `AdminGuard`, `SuperAdminOnlyGuard` — декораторы + гварды для RBAC
- `@CurrentUser()` param-decorator — извлекает `req.user` в контроллерах
- `PrismaModule` + `RedisModule` — оба `@Global()`, экспортируют сервисы без дополнительных imports
- `RedisService extends Redis` — ping в `onModuleInit`, quit в `onModuleDestroy`
- `CORS` через `CORS_ALLOWED_ORIGINS` env (comma-separated), `credentials: true`
- Prisma миграция `20260511000000_init_user_language` (SQL) — Enum Role/CEFR, таблицы User + Language + индексы
- 12 unit-тестов для `TelegramInitDataValidator` — happy path + все кейсы ошибок (реальный алгоритм, без SKIP)

**`apps/web/` — TWA Auth:**

- `tokenHolder.ts` — module-level singleton `{get, set, clear}` для access token
  - Решает circular dependency: `client.ts` ← tokenHolder → `store/auth.ts` (без циклического импорта)
- `client.ts` — axios instance с двумя interceptors:
  - Request: добавляет `Authorization: Bearer <token>` из tokenHolder
  - Response: на 401 → `WebApp.initData` → POST `/auth/telegram/init` → retry (однократный, `_retry` flag)
- `store/auth.ts` — Zustand store: `login(initData)` / `logout()` / `setNotInTelegram()`
  - `login` вызывает API, сохраняет user + пишет token в tokenHolder
- `main.tsx` — проверяет `WebApp.initData`: пустой → `setNotInTelegram()`, иначе → `login(initData)` async (не блокирует рендер)
- `App.tsx` — auth-gated: `loading` → spinner, `not_in_telegram` → NotInTelegram screen, `error` → fallback, `authenticated` → layout
- `NotInTelegram.tsx` — экран-заглушка с кнопкой «Открыть в Telegram»
- `useUserRole.ts` — хук `() => user?.role ?? null`

**`apps/admin/` — NextAuth:**

- `app/api/auth/[...nextauth]/route.ts` — NextAuth v4, CredentialsProvider:
  - `authorize` → POST `/auth/admin/login` → возвращает `{id, accessToken, refreshToken, role, ...}`
  - JWT strategy: `jwt` callback — при истечении access token вызывает `refreshAccessToken()` (POST `/auth/refresh`)
  - `session` callback — пробрасывает accessToken в `session.accessToken`
- `middleware.ts` — `export { default } from 'next-auth/middleware'` + matcher (исключает `/login` + `/api/auth/*`)
- `app/providers.tsx` — `'use client'` SessionProvider wrapper
- `app/login/page.tsx` — реальная форма email+password с `signIn('credentials', {redirect:false})`, error display, `Suspense` wrapper

### Файлы созданы (репо)

```
apps/api/prisma/migrations/20260511000000_init_user_language/migration.sql
apps/api/prisma/migrations/migration_lock.toml
apps/api/src/prisma/prisma.service.ts
apps/api/src/prisma/prisma.module.ts
apps/api/src/redis/redis.service.ts
apps/api/src/redis/redis.module.ts
apps/api/src/modules/auth/dto/{telegram-init,refresh,admin-login}.dto.ts
apps/api/src/modules/auth/telegram-init.validator.ts
apps/api/src/modules/auth/strategies/jwt.strategy.ts
apps/api/src/modules/auth/guards/{jwt-auth,roles,admin,super-admin-only}.guard.ts
apps/api/src/modules/auth/decorators/{public,roles,current-user}.decorator.ts
apps/api/src/modules/auth/auth.service.ts
apps/api/src/modules/auth/auth.controller.ts
apps/api/src/modules/auth/auth.module.ts
apps/api/jest.config.js
apps/api/src/modules/auth/__tests__/telegram-init.validator.spec.ts
apps/web/src/api/token.ts
apps/web/src/api/client.ts
apps/web/src/store/auth.ts
apps/web/src/hooks/useUserRole.ts
apps/web/src/pages/NotInTelegram.tsx
apps/web/.env.local
apps/web/.env.production
apps/admin/app/api/auth/[...nextauth]/route.ts
apps/admin/app/providers.tsx
apps/admin/middleware.ts
```

### Файлы изменены

```
apps/api/src/app.module.ts       — PrismaModule + RedisModule + AuthModule + APP_GUARD
apps/api/src/main.ts             — CORS с CORS_ALLOWED_ORIGINS
apps/api/src/health/health.controller.ts — @Public() добавлен
apps/api/package.json            — "test": "jest"
apps/web/src/main.tsx            — auth auto-init логика
apps/web/src/App.tsx             — auth-gated layout
apps/admin/app/layout.tsx        — <Providers> обёртка
apps/admin/app/login/page.tsx    — реальная форма вместо заглушки
pnpm-workspace.yaml              — unrs-resolver: true
.env.example                     — NEXTAUTH_SECRET, NEXTAUTH_URL добавлены
```

### Проблемы и решения

- **pnpm ERR_PNPM_IGNORED_BUILDS для `unrs-resolver`** — Next-auth устанавливает `unrs-resolver` (native). Решено: `unrs-resolver: true` в `pnpm-workspace.yaml`.
- **TS: `expiresIn` type error в @nestjs/jwt v11** — строгая типизация не принимает `string`. Решено: `as any` cast на payload и expiresIn.
- **TS: `match[1]` typed `string | undefined`** — в `parseTtlToSeconds`. Решено: non-null assertion `match[1]!`.
- **TS: ioredis scan `COUNT` ожидает string** — передавали `100` как number. Решено: `'100'`.
- **TS: `override` на `canActivate` в JwtAuthGuard** — TypeScript strict требует `override`. Добавлено.
- **TS: `RedisService` extends Redis — конфликт property `config`** — ioredis `Redis` base class имеет public `config`. Если `ConfigService` сохранять в `this.config` → конфликт типов. Решено: не сохранять как class property, использовать только в конструкторе как локальную переменную.
- **Circular dependency web: `client.ts` ↔ `store/auth.ts`** — `client.ts` нужен токен из store, store нужен client. `require()` не работает в Vite ESM. Решено: `tokenHolder.ts` singleton — оба модуля импортируют его безопасно.
- **Unit test: `username: undefined` не работает в overrides** — `undefined ?? 'testuser'` = `'testuser'`, username всё равно добавлялся. Решено: переписать тест с ручной конструкцией initData без username в JSON.

### Архитектурные решения

- **Глобальный APP_GUARD + `@Public()`** вместо `@UseGuards()` на каждом роуте — все роуты защищены по умолчанию, opt-out через декоратор. Меньше шанс забыть.
- **Refresh токен только для Admin (NextAuth)** — TWA re-init дешевле (Telegram всегда имеет свежий initData). Refresh через `WebApp.initData` на 401 — стандартный паттерн для TWA.
- **`tokenHolder.ts` singleton** вместо импорта store в axios — разрывает circular dependency без усложнения архитектуры.
- **BigInt → string в `toUserPublic()`** — JSON.stringify не умеет BigInt. Конвертация один раз при сериализации ответа.
- **`secretKey` вычисляется один раз в конструкторе** — не на каждый запрос. `HMAC("WebAppData", bot_token)` — константа для данного бота.
- **SCAN вместо KEYS для revokeFamily** — `KEYS refresh:*` блокирует Redis при большом количестве ключей. SCAN + COUNT 100 = безопасная итерация.

### Проблемы деплоя и решения

- **`@prisma/client` Role undefined** — `pnpm deploy --prod` переустанавливает stub без generated файлов. Решено: `prisma` в `dependencies` + `prisma generate` в CMD startup.
- **Docker healthcheck `localhost` → Connection refused** — Alpine Linux резолвит `localhost` в IPv6 `::1`, приложение слушает IPv4. Решено: `127.0.0.1` в healthcheck + override в compose файле.
- **Next.js Admin не слушает loopback** — Next.js standalone bind к network IP контейнера. Решено: `HOSTNAME=0.0.0.0` в env.
- **GHA build cache** — старый healthcheck кешировался. Решено: override в `docker-compose.yml` на сервере.
- **`infra/compose/docker-compose.yml`** — добавлен в репо для version control.

### Что сделано после деплоя

- `pnpm prisma db seed` выполнен — 5 языков в БД (en/es/fr/zh/uz) ✅
- Все 4 контейнера `(healthy)` ✅
- `https://api-linguolab.muzaffarbahodir.uz/health` → `{"status":"ok"}` ✅

### Что отложили

- **CF WAF rate limiting** для `/auth/*` — Этап 14.
- **Admin refresh_token** хранится в NextAuth session — при смене роли admin придётся выйти вручную. Автоматическая инвалидация — позднее.

### Следующий этап

**Этап 3 — Home + Profile:**

- `GET /users/me` + `/users/me/progress` + `/languages` + `/lessons/upcoming`
- HomeScreen (приветствие, прогресс, языки, ближайший урок)
- ProfileScreen (аватар Telegram, прогресс, меню)

## ✅ Этап 3 — Home + Profile

Дата: 12.05.2026
Статус: ✅ Завершён
PR: #12 — `feat(stage-3): Home + Profile screens`

### Что сделано

**API:**

- `UsersModule` — `GET /users/me` → профиль текущего пользователя (id, имена, роль, locale, timezone)
- `LanguagesModule` — `GET /languages` → все активные языки orderBy name_ru
- `LessonsModule` — `GET /lessons/upcoming` → мок ближайшего урока (завтра 10:00, 60 мин, Английский, Анна Петрова)

**Web:**

- `api/users.ts`, `api/languages.ts`, `api/lessons.ts` — TanStack Query хуки
- `Home.tsx` — приветствие по времени суток, прогресс 65%, карточка урока (скелетон → данные с цветом языка), горизонтальный скролл 5 языков, CTA кнопка «Пробный урок»
- `Profile.tsx` — аватар из `WebApp.initDataUnsafe.user.photo_url` / инициалы, прогресс 70%, 6 пунктов меню с разделителями, Выйти через `WebApp.showConfirm`

### Файлы созданы

```
apps/api/src/modules/users/{users.service,users.controller,users.module}.ts
apps/api/src/modules/languages/{languages.service,languages.controller,languages.module}.ts
apps/api/src/modules/lessons/{lessons.controller,lessons.module}.ts
apps/web/src/api/{users,languages,lessons}.ts
```

### Файлы изменены

```
apps/api/src/app.module.ts  — добавлены UsersModule, LanguagesModule, LessonsModule
apps/web/src/pages/Home.tsx — полная реализация
apps/web/src/pages/Profile.tsx — полная реализация
```

### Следующий этап

**Этап 4 — Каталог + классы:**

- Prisma: модели `Class`, `Enrollment`, `Teacher`
- `GET /classes` — список групп (по языку, уровень CEFR, учитель)
- `POST /classes/:id/enroll` — запись в класс
- `GET /classes/:id` — детали класса
- Страница Courses.tsx — карточки классов с фильтром по языку

## ✅ Этап 4 — Каталог + классы

Дата: 12.05.2026
Статус: ✅ Завершён
PR: #13 — `feat(stage-4): catalog + classes with enrollment`

### Что сделано

**Prisma:**

- `EnrollmentStatus` enum (PENDING/ACTIVE/DROPPED)
- `Teacher` (1:1 с User, bio, photo_url)
- `Class` (language, teacher, level CEFR, price_uzs, max_students, description)
- `Enrollment` (student M2M class, unique constraint, status)
- Миграция `20260512000000_add_teacher_class_enrollment`

**Seed (выполнен на сервере):**

- 5 языков ✅, 2 учителя ✅, 6 классов ✅
- Анна Петрова: EN A1/B1, FR A2, ES A1
- Давид Ли: ZH HSK1/HSK3

**API — ClassesModule:**

- `GET /classes?languageId&level` — список с фильтром, enrolled_count, spots_left
- `GET /classes/:id` — детали
- `POST /classes/:id/enroll` — запись (409 если уже записан, 400 если мест нет)

**Web — Courses.tsx:**

- Фильтр по языку (таблетки)
- Карточки: флаг, уровень (цветной badge), название, описание, учитель, цена, места
- «Записаться» → `showConfirm` → success/error alerts

### Следующий этап

**Этап 5 — Запись на урок (3 шага):**

- Выбор языка → выбор класса → подтверждение
- BookingModule: `POST /bookings` + статусы (PENDING→CONFIRMED→CANCELLED)
- Schedule tab: список своих уроков по датам
- Уведомление через Telegram бот после записи

## ✅ Этап 5 — Запись на урок (3 шага)

Дата: 12.05.2026
Статус: ✅ Завершён
PR: #14 — `feat(stage-5): booking flow + schedule tab`

### Что сделано

**5.1 — Booking Flow (`/book`):**

- Step 1: сетка языков (5 карточек с цветами), шаг 1/3
- Step 2: список классов выбранного языка, занятые задизейблены, шаг 2/3
- Step 3: карточка подтверждения (учитель, цена, места) + кнопка «Отправить заявку», шаг 3/3
- Telegram `BackButton` — навигация назад между шагами / на Home
- BottomNav скрыт на `/book`, Home CTA теперь ведёт на `/book`
- После успеха: `showAlert` → navigate `/schedule`

**5.2 — Schedule Tab:**

- `EnrollmentsModule`: `GET /enrollments/my` → записи студента (ACTIVE/PENDING)
- `useMyEnrollments` hook
- `Schedule.tsx`: карточки записей с цветными статус-бейджами
- Пустое состояние → кнопка «Записаться в класс» → `/book`

**Git Workflow fix:**

- `.github/workflows/sync-develop.yml` — авто-sync `main → develop` после каждого merge
- Документировано в `project_progress.md` (секция "Git Workflow")

## ✅ Этап 6 — Telegram-бот (grammY)

Дата: 12.05.2026
Статус: ✅ Завершён
Коммиты в `main`:

- `877d660` — PR #15 `feat(stage-6): Telegram bot (grammY) with webhook + enrollment notify`
- `549a528` — `fix(telegram): import Update from grammy/types not grammy` (typecheck fix, в develop, pending PR)

### Что сделано

**API (`apps/api`):**

- `grammy` v1.42.0 установлен
- `TelegramService` — webhook-режим (`bot.handleUpdate()`), не `bot.start()`
  - `onModuleInit` — инициализирует бота только если токен задан (graceful no-op)
  - `/start` — приветствие + InlineKeyboard с кнопкой открыть TWA
  - `notifyEnrolled(telegramUserId, classTitle, teacherName, languageEmoji)` — HTML-уведомление
- `TelegramController` — `POST /api/v1/telegram/webhook`
  - Защита через `x-telegram-bot-api-secret-token` header
  - `@Public()` — JWT guard пропускает
- `TelegramModule` — `@Global()`, экспортирует TelegramService
- `ClassesService` — внедрён TelegramService, `void this.sendEnrollmentNotification()` после записи (fire-and-forget)

**Webhook зарегистрирован на сервере:**

```
{"ok":true,"result":true,"description":"Webhook was set"}
```

URL: `https://api-linguolab.muzaffarbahodir.uz/api/v1/telegram/webhook`

## ✅ Этап 7 — Telegram-группы для классов

Дата: 12.05.2026
Статус: ✅ Завершён
PRs в `main`: #17, #18

### Что сделано

**API (`apps/api`):**

- Prisma: `Class.telegram_chat_id BigInt?` — менеджер привязывает Telegram-группу к классу
- Миграция: `20260512100000_add_telegram_chat_id_to_class`
- `RolesGuard` зарегистрирован глобально как второй `APP_GUARD` (после JwtAuthGuard)
- `TelegramService.sendGroupInvite()` — одноразовая invite-ссылка студенту при одобрении
- `GET /enrollments` — все записи для менеджера (фильтр `?status=`)
- `PATCH /enrollments/:id/status` — одобрить (ACTIVE) / отклонить (DROPPED); при ACTIVE + chat_id → бот отправляет invite
- `PATCH /classes/:id/group` — установить telegram_chat_id (только MANAGER+)

**Admin-панель (`apps/admin`):**

- `app/api/auth/[...nextauth]/route.ts` — NextAuth credentials provider (вызывает API `/auth/admin/login`)
- `lib/auth.ts` — единый `authOptions`, передаётся в `getServerSession(authOptions)` везде
- `types/next-auth.d.ts` — расширение типов (accessToken, role в session)
- `/enrollments` — список PENDING заявок с кнопками Одобрить / Отклонить
- `/classes` — список классов с формой привязки Telegram-группы (chat_id)
- `/api/proxy/*` — прокси-роуты, токен остаётся на сервере (клиент не видит)
- Dashboard обновлён — 4 карточки с навигацией

**Проблемы и решения:**

- `getServerSession()` без `authOptions` → всегда null в App Router. Решение: вынести в `lib/auth.ts`, передавать везде
- `INSERT 0 0` при создании admin-юзера → он уже был с другим хешем. Решение: `UPDATE ... SET password_hash`
- Admin-пользователь создан вручную через psql: `admin@linguolab.uz` / `AdminPass123!`

**Проверено на сервере:**

- Логин в admin-панель работает ✅
- Dashboard открывается ✅

## ✅ Этап 8 — Расписание (новый таб)

Дата: 12.05.2026
Статус: ✅ Завершён
PR: #19 — `feat(stage-8): class schedule management`

### Что сделано

**Prisma + Миграция:**

- `Class` модель: добавлены `schedule_days String[]`, `schedule_time String?`, `schedule_duration Int?`
- Миграция `20260512120000_add_schedule_to_class` (TEXT[], TEXT, INTEGER)

**API (`apps/api`):**

- `PATCH /classes/:id/schedule` — установить расписание (только MANAGER+): массив дней недели (MON/TUE/…), время HH:MM, длительность в минутах
- `GET /lessons/upcoming` — реальная реализация вместо мока:
  - Берёт ACTIVE записи студента
  - `getNextSession()` — вычисляет ближайшую дату занятия в UTC+5 (Ташкент), перебирает 8 дней вперёд
  - Возвращает сортированный список, отдаёт ближайший или null
- `enrollments.service.ts` — `enrollmentFullSelect` расширен: schedule_days, schedule_time, schedule_duration
- `classes.service.ts` — schedule поля в `classListSelect` + метод `setSchedule()`

**Admin-панель (`apps/admin`):**

- `SetScheduleForm` — Client Component: выбор дней недели (кнопки-таблетки), поле времени, поле длительности (мин), кнопка Сохранить
- `/classes` page — показывает текущее расписание каждого класса + `SetScheduleForm`
- Прокси-роуты разделены на отдельные пути:
  - `/api/proxy/classes/[id]/group/route.ts` → `PATCH /api/v1/classes/:id/group`
  - `/api/proxy/classes/[id]/schedule/route.ts` → `PATCH /api/v1/classes/:id/schedule`

**TWA (`apps/web`):**

- `MyEnrollment` тип: добавлены `schedule_days`, `schedule_time`, `schedule_duration`
- `Schedule.tsx` — `EnrollmentCard` теперь показывает:
  - Блок расписания: `🗓 Пн, Ср, Пт • 10:00 • 90 мин`
  - Ближайшее занятие: `Ближайший: Ср, 14 мая в 10:00` (вычисляется локально в UTC+5)
  - Если ACTIVE но расписания нет: `Расписание уточняется`

### Файлы созданы

```
apps/api/prisma/migrations/20260512120000_add_schedule_to_class/migration.sql
apps/api/src/modules/lessons/lessons.service.ts
apps/admin/app/classes/set-schedule-form.tsx
apps/admin/app/api/proxy/classes/[id]/group/route.ts
apps/admin/app/api/proxy/classes/[id]/schedule/route.ts
```

### Файлы изменены

```
apps/api/prisma/schema.prisma             — schedule поля в Class
apps/api/src/modules/classes/classes.service.ts    — setSchedule() + select
apps/api/src/modules/classes/classes.controller.ts — PATCH /schedule эндпоинт
apps/api/src/modules/enrollments/enrollments.service.ts — schedule в select
apps/api/src/modules/lessons/lessons.controller.ts — реальный @CurrentUser() + сервис
apps/api/src/modules/lessons/lessons.module.ts     — LessonsService провайдер
apps/admin/app/classes/page.tsx           — SetScheduleForm + schedule display
apps/web/src/api/enrollments.ts           — schedule поля в MyEnrollment type
apps/web/src/pages/Schedule.tsx           — расписание + ближайший урок
```

### Проблемы и решения

- **CI: TS2339 schedule_days/time/duration не существует** — `MyEnrollment.class` в `enrollments.ts` не имел новых полей. Добавлены 3 поля в тип → CI зелёный.
- **Прокси-роут конфликт** — старый `[id]/route.ts` PATCH шёл на `/group` но `SetGroupForm` вызывал `/api/proxy/classes/:id/group`. Разделили на отдельные sub-routes `/group/route.ts` и `/schedule/route.ts`.

## ✅ Этап 9 — Quick actions

Дата: 12.05.2026
Статус: ✅ Завершён
PR: #20 — `feat(stage-9): quick actions — trial, support, referral`

### Что сделано

**Prisma + Миграция:**

- Новые enum: `TrialStatus` (PENDING/CONFIRMED/CANCELLED), `TicketStatus` (OPEN/IN_PROGRESS/CLOSED)
- `TrialLessonRequest` — заявка на пробный урок (student, language, note?, status)
- `SupportTicket` — тикет поддержки (student, subject, message, status)
- `Referral` — реферальный код (referrer 1:1, code unique, used_count)
- Миграция `20260512130000_add_quick_actions`

**API (`apps/api`):**

- `TrialLessonsModule`:
  - `POST /trial-lessons/request` — создаёт заявку; 400 если уже есть PENDING на этот язык
  - `GET /trial-lessons/my` — список своих заявок
- `SupportModule`:
  - `POST /support/tickets` — создаёт тикет (subject 3–120 символов, message 10–2000)
  - `GET /support/tickets/my` — список своих тикетов
- `ReferralsModule`:
  - `GET /referrals/my` — возвращает код или создаёт новый (уникальный 6-символ base36, retry на коллизию)

**TWA (`apps/web`):**

- `BottomSheet` — переиспользуемый компонент (backdrop, handle-bar, блокировка scroll body)
- `QuickActionsSheet` — 3 вложенных экрана внутри BottomSheet:
  - **Пробный урок**: выбор языка (таблетки) + поле пожеланий → POST → showAlert
  - **Поддержка**: поля subject + message с клиентской валидацией → POST → showAlert
  - **Реферал**: показывает ссылку `t.me/linguolab_bot/app?startapp=ref_CODE`, кнопка «Копировать»
- `quick-actions.ts` — хуки: `useRequestTrial`, `useMyTrials`, `useCreateTicket`, `useMyReferral`
- `Home.tsx` — кнопка ⚡ рядом с «Записаться в класс» открывает QuickActionsSheet

### Файлы созданы

```
apps/api/prisma/migrations/20260512130000_add_quick_actions/migration.sql
apps/api/src/modules/trial-lessons/{controller,service,module}.ts
apps/api/src/modules/support/{controller,service,module}.ts
apps/api/src/modules/referrals/{controller,service,module}.ts
apps/web/src/api/quick-actions.ts
apps/web/src/components/BottomSheet.tsx
apps/web/src/components/QuickActionsSheet.tsx
```

### Файлы изменены

```
apps/api/prisma/schema.prisma   — новые модели и enums + relations на User/Language
apps/api/src/app.module.ts      — регистрация 3 новых модулей
apps/web/src/pages/Home.tsx     — кнопка ⚡ + QuickActionsSheet
```

## ✅ Фича: Выбор языка интерфейса (между Этапами 9 и 10)

Дата: 12.05.2026
Статус: ✅ Завершён (не в плане PLAN_FINAL, добавлено по запросу)

### Что сделано

- `useLanguage.ts` — хук + module-level singleton `_locale`:
  - Инициализация: `sessionStorage` (sync cache) → `WebApp.initDataUnsafe.user.language_code` (fallback)
  - Асинхронно читает `WebApp.CloudStorage.getItem('user_language')` при старте
  - `applyLocale(code)` — обновляет `_locale`, `sessionStorage`, `document.documentElement.lang`, `CloudStorage`
  - Кросс-компонентная реактивность через `window.dispatchEvent(new Event('linguolab:locale-change'))`
  - Константа `LANGUAGES: LangOption[]` — `ru` / `uz` / `en` с флагами
- `LanguageSelect.tsx` — страница `/language`:
  - 3 кнопки-строки с флагом, названием, галочкой ✓ на текущем
  - Haptic feedback `WebApp.HapticFeedback.selectionChanged()` при выборе
  - После выбора: `navigate(-1)` возврат
- `Profile.tsx` — меню: добавлен пункт «🌐 Язык / Til / Language» с hint-текущим языком
- `App.tsx` — добавлен роут `<Route path="/language" element={<LanguageSelectPage />} />`

### Примечание

PLAN_FINAL указывает `i18next` как библиотеку, но она не установлена. Реализован
кастомный механизм без зависимостей: `CloudStorage` (persistent) + `sessionStorage` (sync read).
Перевода строк интерфейса пока нет — только выбор locale для будущего i18n.

### Файлы созданы

```
apps/web/src/hooks/useLanguage.ts
apps/web/src/pages/LanguageSelect.tsx
```

### Файлы изменены

```
apps/web/src/pages/Profile.tsx  — пункт меню + hint с текущим языком
apps/web/src/App.tsx            — роут /language
```

---

## ✅ Фича: i18next интернационализация (RU / UZ / EN)

Дата: 12.05.2026
Статус: ✅ Завершён
Коммит: `5da0ecf` — `feat(web): full i18next internationalization (RU/UZ/EN)`
Коммит: `fix(web): add I18nextProvider + remove initImmediate (language switch fix)`

### Причина

Выбор языка на странице `/language` менял `_locale` и `sessionStorage`, но текст UI
не перерисовывался — не было механизма который уведомлял бы React-компоненты
о смене языка через `useTranslation()`.

### Что сделано

**Библиотеки:**

- `i18next` + `react-i18next` — установлены в `apps/web`

**Файлы переводов (`public/locales/{ru,uz,en}/translation.json`):**

- 10 namespace'ов: `nav`, `home`, `schedule`, `courses`, `profile`, `booking`,
  `language_select`, `not_in_telegram`, `app`, `quick_actions`
- Inline Vite import (не http-backend) — нет async flickering

**`apps/web/src/lib/i18n.ts`** (создан):

- `i18n.use(initReactI18next).init({ resources: {ru,uz,en}, lng: sessionStorage })` — синглтон
- Язык из `sessionStorage.getItem('user_language')` при старте

**`apps/web/src/main.tsx`** (обновлён):

- `import i18n from './lib/i18n'` — инициализация до рендера
- `<I18nextProvider i18n={i18n}>` — обёртка вокруг всего приложения, гарантирует
  что `useTranslation()` подписан на `languageChanged` событие i18next

**`apps/web/src/hooks/useLanguage.ts`** (обновлён):

- `applyLocale()` теперь вызывает `void i18n.changeLanguage(code)` перед DOM-event
- CloudStorage callback тоже вызывает `i18n.changeLanguage(value)` при восстановлении

**Все страницы и компоненты** — заменены захардкоженные строки:

```
App.tsx, BottomNav.tsx, Home.tsx, Schedule.tsx, Courses.tsx,
Profile.tsx, Booking.tsx, LanguageSelect.tsx, NotInTelegram.tsx,
QuickActionsSheet.tsx
```

### Паттерны

- `formatPrice(uzs, sumLabel)` — принимает переведённый лейбл как параметр (не хук)
- `formatSchedule(days, time, duration, t: TFunction)` — `t` передаётся в pure-функцию
- `ACTIONS` массив в QuickActionsSheet — перемещён внутрь компонента для live `t()`
- `getDateLocale()` — читает `i18n.language` для `toLocaleDateString`

### Файлы созданы

```
apps/web/public/locales/ru/translation.json
apps/web/public/locales/uz/translation.json
apps/web/public/locales/en/translation.json
apps/web/src/lib/i18n.ts
```

### Файлы изменены

```
apps/web/src/main.tsx              — I18nextProvider + import i18n
apps/web/src/hooks/useLanguage.ts  — applyLocale → i18n.changeLanguage()
apps/web/src/App.tsx               — useTranslation
apps/web/src/components/BottomNav.tsx
apps/web/src/components/QuickActionsSheet.tsx
apps/web/src/pages/Home.tsx
apps/web/src/pages/Schedule.tsx
apps/web/src/pages/Courses.tsx
apps/web/src/pages/Profile.tsx
apps/web/src/pages/Booking.tsx
apps/web/src/pages/LanguageSelect.tsx
apps/web/src/pages/NotInTelegram.tsx
```

---

## ✅ Этап 10 — ДЗ + достижения + Cloudflare R2

Дата: 13.05.2026
Статус: ✅ Завершён
PRs в `main`: #23 (backend), #24 (TWA frontend)

### Что планировалось

StorageModule (R2 presigned uploads), HomeworkModule (create/submit/grade), AchievementsModule (auto-unlock), CertificatesModule (PDF), TWA-страницы для ДЗ и достижений.

### Что сделано (подробно)

**Prisma + Миграция `20260513000000_add_homework_achievements_certificates`:**

- Enums: `HomeworkSubmissionStatus { SUBMITTED GRADED LATE }`, `AchievementTrigger { FIRST_ENROLLMENT FIRST_HOMEWORK HOMEWORK_STREAK_5 HOMEWORK_STREAK_10 PERFECT_GRADE TRIAL_COMPLETED REFERRAL_1 }`
- Модели: `Homework` (class, title, description, due_date), `HomeworkSubmission` (homework, student, file_key, file_url, text_answer, grade, feedback, status), `Achievement` (trigger, title_ru/uz/en, description_ru/uz/en, icon), `UserAchievement` (user, achievement, unlocked_at), `Certificate` (student, class, pdf_url, issued_at)
- Relations добавлены на `User` и `Class`
- INSERT seed: 7 Achievement записей для всех 7 триггеров

**API — StorageModule:**

- `POST /storage/presigned-upload` — принимает `{filename, content_type}`, генерирует key `uploads/<userId>/<uuid><ext>`, возвращает `{key, uploadUrl, publicUrl}` (TTL 15 мин)
- `StorageService.presignedUpload()`, `publicUrl()`, `deleteObject()`
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` установлены

**API — AchievementsModule:**

- `AchievementsService.unlock(userId, trigger)` — приватный метод, идемпотентный
- `onEnrollment`, `onHomeworkSubmitted` (проверяет count для streak_5/10), `onPerfectGrade`, `onTrialCompleted`, `onReferral`
- `GET /achievements/my` → `{unlocked: [...], locked: [...]}`
- `@Global()` — экспортируется без дополнительных imports в других модулях

**API — HomeworkModule:**

- `POST /homework` — создать ДЗ (TEACHER/MANAGER)
- `GET /homework/class/:classId` — список ДЗ для класса
- `GET /homework/my` — все ДЗ студента (по активным enrollments) с `my_submission`
- `POST /homework/:id/submit` — сдать (text_answer или file_key+file_url), late-detection через `due_date`, триггерит `achievements.onHomeworkSubmitted()`
- `PATCH /homework/submissions/:id/grade` — выставить оценку (0–100), если 100 → `achievements.onPerfectGrade()`
- `GET /homework/:id/submissions` — сданные работы (для учителя)

**API — CertificatesModule:**

- `POST /certificates/issue` — менеджер выдаёт сертификат: генерирует PDF (pdfkit, A4 landscape, фиолетовый брендинг), PUT в R2 через presigned URL, создаёт Certificate запись
- `GET /certificates/my` — список своих сертификатов

**GitHub Actions — deploy-api.yml:**

- Добавлен шаг "Inject R2 secrets into server .env": `sed -i '/^R2_/d'` → `cat >> .env <<ENVEOF`
- Добавлен шаг "Run DB migration": `sleep 8 && docker exec linguolab_api npx prisma migrate deploy`
- R2 секреты (6 штук) добавлены в GitHub Secrets через UI

**TWA — API хуки:**

- `api/homework.ts`: `useMyHomework()`, `useSubmitHomework()` (R2 presigned upload flow: getPresignedUpload → PUT file → submit with key)
- `api/achievements.ts`: `useMyAchievements()`

**TWA — Страницы:**

- `pages/Homework.tsx`:
  - `statusBadge(submission, due, t)` — статус-бейдж с цветом (submitted/graded/late/pending/overdue)
  - `formatDue(due, t, lang)` — человекочитаемый дедлайн
  - `SubmitSheet` — bottom-sheet: textarea или file-picker (hidden input), loading states (uploading/sending), error display
  - `HomeworkCard` — карточка с описанием, дедлайном, оценкой+feedback, кнопкой сдать
- `pages/Achievements.tsx`:
  - `AchievementCard` — иконка + локализованный title/description (читает `title_${lang}` динамически)
  - Секция "Получено" + секция "Заблокировано" (grayed, opacity-60)
  - unlock date для полученных

**i18n:**

- Добавлены ключи `homework.*` (24 ключа) и `achievements.*` (6 ключей) в ru/uz/en translation.json

**Роутинг:**

- Profile → "Домашние задания" теперь `navigate('/homework')` (раньше stub-alert)
- Profile → "Достижения" теперь `navigate('/achievements')` (раньше stub-alert)
- `App.tsx`: добавлены роуты `/homework` и `/achievements`
- `isBooking` расширен до массива `['/book', '/homework', '/achievements']` — BottomNav скрыт

### Файлы созданы

```
apps/api/prisma/migrations/20260513000000_add_homework_achievements_certificates/migration.sql
apps/api/src/modules/storage/{storage.service,storage.controller,storage.module}.ts
apps/api/src/modules/achievements/{achievements.service,achievements.module}.ts
apps/api/src/modules/homework/{homework.service,homework.controller,homework.module}.ts
apps/api/src/modules/homework/dto/{create-homework,submit-homework,grade-homework}.dto.ts
apps/api/src/modules/certificates/{certificates.service,certificates.controller,certificates.module}.ts
apps/web/src/api/homework.ts
apps/web/src/api/achievements.ts
apps/web/src/pages/Homework.tsx
apps/web/src/pages/Achievements.tsx
```

### Файлы изменены

```
apps/api/prisma/schema.prisma             — 5 новых моделей + 2 enum + relations
apps/api/src/app.module.ts                — регистрация 4 новых модулей
apps/api/package.json                     — @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, pdfkit
.github/workflows/deploy-api.yml          — inject R2 secrets + prisma migrate deploy
apps/web/public/locales/ru/translation.json — homework.* + achievements.*
apps/web/public/locales/uz/translation.json — то же
apps/web/public/locales/en/translation.json — то же
apps/web/src/App.tsx                      — 2 новых роута + isBooking массив
apps/web/src/pages/Profile.tsx            — navigate вместо stub для homework/achievements
```

### Проблемы и решения

- **R2 env var mismatch** — код использовал `R2_BUCKET` / `R2_CDN_URL`, у пользователя `R2_BUCKET_NAME` / `R2_PUBLIC_URL`. Исправлено в `storage.service.ts`.
- **Prisma client не регенерирован** — после добавления новых enum TS выдавал `Module '"@prisma/client"' has no exported member 'AchievementTrigger'`. Решение: `pnpm --filter @linguolab/api exec prisma generate`.
- **DTO strict TS** — `Property has no initializer`. Решение: `!` на всех required DTO свойствах.
- **`@types/pdfkit` missing** — `error TS7016`. Решение: `pnpm --filter @linguolab/api add -D @types/pdfkit`.
- **`TFunction` не экспортируется из `react-i18next`** — импорт перенесён в `import type { TFunction } from 'i18next'`.
- **git push rejected** после sync-develop GHA — `git pull origin develop --no-edit && git push origin develop`.

### Архитектурные решения

- **AchievementsModule `@Global()`** — позволяет инжектировать AchievementsService в HomeworkModule и EnrollmentsModule без лишних imports.
- **R2 presigned upload в два шага** — клиент получает URL, делает PUT напрямую в R2 (без проксирования через API), затем отправляет `{file_key, file_url}` в submit. Минимум нагрузки на API.
- **Inject R2 secrets через GH Actions SSH** — не хранятся в compose/.env постоянно, пересчитываются при каждом деплое. `sed '/^R2_/d'` сначала чистит старые, потом heredoc добавляет новые.
- **`prisma migrate deploy` автоматически** — в deploy workflow через `sleep 8` (ждём старт контейнера), `docker exec linguolab_api npx prisma migrate deploy`.

### Следующий этап

**Этап 11 — Платежи UZ (Payme / Click / Uzumbank)**

## ✅ Этап 11 — Платежи UZ (Payme + Click + Uzumbank)

Дата: 13.05.2026
Статус: ✅ Завершён
Коммиты в `develop`:

- `48a282a` — `feat: complete 9 missed items before Этап 11`
- `34c2690` — `feat(payments): Этап 11 — Payme integration + Payment TWA page`
- `85a292f` — `fix: close 7 gaps found in audit (Этапы 1-11)`

### Что сделано до Этапа 11 (закрытие 9+7 пропущенных пунктов)

**Пропущенные пункты (commit 48a282a):**

- `PlacementTestsModule` — `POST /placement-tests/start`, `POST /placement-tests/:id/answer`,
  `POST /placement-tests/:id/complete`, `GET /placement-tests/my`
- `Lessons` расширен: `createLesson()`, `getClassLessons()`, `bulkAttendance()`, `getLessonAttendance()`
- `GET /lessons/history` — завершённые уроки студента по активным enrollments
- `GET /lessons/:id` — одиночный урок с посещаемостью
- `POST /lessons` — создать урок (TEACHER+)
- `GET /lessons/class/:classId` — уроки класса
- `POST /lessons/:id/attendance/bulk` — массовая отметка посещаемости
- `GET /lessons/:id/attendance` — посещаемость урока
- `AdminModule` полный:
  - `GET /admin/dashboard/widgets` — 7 параллельных count-запросов
  - CRUD `/admin/students` (list с поиском, get с enrollments, update, delete)
  - CRUD `/admin/teachers` (list, create = User(TEACHER)+Teacher, update, delete с проверкой)
  - CRUD `/admin/classes`
  - `GET /admin/users` + `PATCH /admin/users/:id/role` (с защитой от эскалации + token_version++)
- `common/money.ts` — `uzsToTiyin()` (умножение на 100), `calcVatTiyin()` (12% НДС UZ)
- Миграции: `20260513040000_add_lessons`, `20260513050000_add_payments`
- Prisma: `Lesson`, `LessonAttendance`, `LessonStatus`, `AttendanceStatus` enums
- Prisma: `Payment`, `FiscalReceipt`, `WebhookEvent`, `PaymentProviderConfig`
- Prisma: `PaymentProvider`, `PaymentStatus`, `FiscalStatus`, `ReceiptType` enums

**Аудит-фиксы (commit 85a292f):**

- `PATCH /users/me` — обновление профиля (first_name, last_name, locale, timezone, avatar_url)
- `GET /users/me/progress` — прогресс студента (enrollments, homework groupBy, achievements count,
  last placement test)
- `PATCH /users/me/notification-channels` — заглушка `{ok: true, acknowledged: true}` (Этап 12)
- `GET /lessons/history` — история уроков студента
- Click webhook полный: `prepare()` + `complete()` с MD5-подписью
- Uzumbank stub (placeholder URL)
- `handlePaymentPaid()` — после оплаты: enrollment PENDING→ACTIVE + TG group invite

### Что сделано в Этапе 11 (commit 34c2690)

**Prisma — схема:**

- `Payment` — `id (cuid)`, `user_id`, `class_id`, `amount_tiyin (BigInt)`,
  `vat_amount_tiyin (BigInt)`, `provider (PaymentProvider)`, `status (PaymentStatus)`,
  `idempotency_key (UNIQUE)`, `provider_txn_id?`, `provider_state (Int)?`,
  `paid_at?`, `payload_in/out (Json)?`
- Named relations: `PaymentUser` (user→payments), `PaymentPayer` (user→payments_as_payer)
- `FiscalReceipt` — связь с Payment, OFD-поля (receipt_id, fiscal_sign, status)
- `WebhookEvent` — `@@unique([provider, external_id])`, upsert-идемпотентность
- `PaymentProviderConfig` — конфиги провайдеров (enabled/disabled), сид: Payme enabled, Click/Uzumbank disabled

**API — PaymentsModule:**

- `common/money.ts`: `uzsToTiyin(uzs)` = uzs × 100, `calcVatTiyin(tiyin)` = tiyin × 12 / 112

- `payments.service.ts`:
  - `checkout(userId, dto)` — идемпотентность через idempotency_key; создаёт Payment PENDING;
    возвращает redirect URL
  - `buildProviderUrl()`:
    - Payme: `base64(m=merchantId;ac.order_id=key;a=tiyin)` → `PAYME_CHECKOUT_URL/<b64>`
    - Click: query-params `service_id`, `merchant_id`, `amount`, `transaction_param`, `return_url`
    - Uzumbank: stub `https://uzumbank.uz/pay?order=...`
  - `myPayments(userId)` — история (50 записей), BigInt→string
  - `getPayment(paymentId, userId)` — одна запись с классом
  - `getLastPending(userId)` — последний PENDING платёж с redirect URL
  - `adminListPayments(page, limit, status?)` — пагинация с user+class
  - `adminRefund(paymentId)` — PAID→REFUNDED (реальный API провайдера — TODO Этап 12)

- `payme/payme.types.ts`:
  - `PaymeState { PENDING:1, COMPLETED:2, CANCELLED:-1, CANCELLED_AFTER_COMPLETE:-2 }`
  - `PaymeError { PARSE_ERROR:-32700, METHOD_NOT_FOUND:-32601, ... ORDER_NOT_FOUND:-31050,
INVALID_AMOUNT:-31001, ORDER_ALREADY_PAID:-31099, TRANSACTION_NOT_FOUND:-31003,
UNABLE_TO_PERFORM:-31008, INVALID_PARAMS:-32600, INTERNAL_ERROR:-32603 }`
  - `paymeError(id, code, message, data?)`, `paymeResult(id, result)`

- `payme/payme.service.ts` (полный JSON-RPC 2.0 хендлер):
  - `CheckPerformTransaction` — проверяет payment, статус, сумму
  - `CreateTransaction` — сохраняет `provider_txn_id`, 12ч таймаут
  - `PerformTransaction` — AUTHORIZED→PAID + fire-and-forget `handlePaymentPaid()`
  - `CancelTransaction` — идемпотентно; PAID→REFUNDED (state -2), остальные→CANCELLED (state -1)
  - `CheckTransaction` — возвращает state, create/perform/cancel time
  - `GetStatement` — список PAID транзакций за период
  - `handlePaymentPaid()` — enrollment PENDING→ACTIVE + `telegram.sendGroupInvite()`
  - `logWebhook()` — upsert WebhookEvent (non-critical, try/catch)
  - Инжектирует TelegramService напрямую (не через PaymentsService — нет circular dep)

- `click/click.service.ts` (2-фазный webhook):
  - `prepare(body)` — проверяет подпись, статус payment, обновляет provider_txn_id→AUTHORIZED
  - `complete(body)` — проверяет подпись; error<0 → CANCELLED; иначе PAID + `handlePaymentPaid()`
  - `verifySign(params, merchantPrepareId)`:
    - `MD5(click_trans_id + service_id + secret + merchant_trans_id + [prepareId+secret] + amount + action + sign_time)`
    - Если `CLICK_SECRET_KEY` не задан → warn + skip (dev-friendly)
  - `handlePaymentPaid()` — та же логика что в PaymeService (enrollment + TG invite)
  - `logWebhook()` — upsert WebhookEvent

- `payments.controller.ts`:
  - `POST /payments/checkout` — JWT protected, создаёт платёж
  - `POST /payments/payme` — @Public, Basic Auth verify (`PAYME_MERCHANT_KEY`)
  - `POST /payments/click/prepare` — @Public, Click prepare phase
  - `POST /payments/click/complete` — @Public, Click complete phase
  - `GET /payments/history` — JWT, история студента
  - `GET /payments/last-pending` — JWT, последний незавершённый
  - `GET /payments/:id` — JWT, деталь платежа
  - `GET /admin/payments` — JWT + MANAGER+, admin список
  - `POST /admin/payments/:id/refund` — JWT + ADMIN+, возврат
  - `verifyPaymeAuth(req)` — приватный: `Authorization: Basic base64(login:password)`,
    декодирует, берёт часть после `:`, сравнивает с `PAYME_MERCHANT_KEY`

- `payments.module.ts` — импортирует TelegramModule, провайдеры: PaymentsService, PaymeService,
  ClickService

**TWA — Frontend:**

- `apps/web/src/api/payments.ts`:
  - `useCheckout()` — `useMutation`, POST `/payments/checkout`,
    `idempotency_key: crypto.randomUUID()`
  - `useMyPayments()` — `useQuery`, GET `/payments/history`
  - `useLastPending()` — `useQuery`, GET `/payments/last-pending`

- `apps/web/src/pages/Payment.tsx`:
  - Принимает `{ classId, classTitle, priceUzs }` из `location.state`
  - Выбор провайдера: Payme💳 / Click🔵 / Uzumbank🟠 (radio-кнопки)
  - Кнопка «Оплатить» → `useCheckout()` → `WebApp.openLink(result.redirect_url)`
  - История платежей: статус-бейджи с цветовой схемой (PAID=green, PENDING=yellow,
    CANCELLED=red, REFUNDED=gray)
  - Лоадер во время мутации, отображение суммы в UZS

- `apps/web/src/pages/Booking.tsx`:
  - `StepConfirm` → кнопка «Оплатить сейчас» → `navigate('/payment', { state: {...} })`

- `apps/web/src/App.tsx`:
  - Роут `/payment` + добавлен в `isBooking` (BottomNav скрыт)

- i18n: ключи `payment.*` в `ru/uz/en/translation.json`:
  - `title, select_provider, amount, class, pay_btn, paying, history_title, history_empty`
  - `status_PENDING/AUTHORIZED/PAID/CANCELLED/REFUNDED/FAILED/EXPIRED`
  - `redirect_hint, back_to_class, load_error`

- `.env.example`: добавлены `PAYME_MERCHANT_KEY`, `PAYME_CHECKOUT_URL` (переименован
  из `PAYME_ENDPOINT`)

### Файлы созданы

```
apps/api/src/common/money.ts
apps/api/src/modules/payments/payments.service.ts
apps/api/src/modules/payments/payments.controller.ts
apps/api/src/modules/payments/payments.module.ts
apps/api/src/modules/payments/payme/payme.types.ts
apps/api/src/modules/payments/payme/payme.service.ts
apps/api/src/modules/payments/click/click.service.ts
apps/api/src/modules/placement-tests/placement-tests.controller.ts
apps/api/src/modules/placement-tests/placement-tests.module.ts
apps/api/src/modules/admin/admin.service.ts
apps/api/src/modules/admin/admin.controller.ts
apps/api/src/modules/admin/admin.module.ts
apps/api/prisma/migrations/20260513040000_add_lessons/migration.sql
apps/api/prisma/migrations/20260513050000_add_payments/migration.sql
apps/web/src/api/payments.ts
apps/web/src/pages/Payment.tsx
```

### Файлы изменены

```
apps/api/prisma/schema.prisma              — Lesson, LessonAttendance, Payment и др.
apps/api/src/modules/users/users.service.ts     — updateMe, getProgress, updateNotificationChannels
apps/api/src/modules/users/users.controller.ts  — PATCH /me, GET /me/progress, PATCH /me/notifications
apps/api/src/modules/lessons/lessons.service.ts — getHistory, getOne, createLesson, etc.
apps/api/src/modules/lessons/lessons.controller.ts — новые эндпоинты
apps/api/src/app.module.ts                — PlacementTestsModule, AdminModule, PaymentsModule
apps/web/src/pages/Booking.tsx            — кнопка «Оплатить сейчас»
apps/web/src/App.tsx                      — роут /payment
apps/web/public/locales/ru/translation.json — payment.*
apps/web/public/locales/uz/translation.json — payment.*
apps/web/public/locales/en/translation.json — payment.*
.env.example                              — PAYME_MERCHANT_KEY, PAYME_CHECKOUT_URL
```

### Архитектурные решения

- **BigInt→string** — `amount_tiyin` и `vat_amount_tiyin` хранятся как Prisma `BigInt`.
  Все API-ответы преобразуют в `.toString()` (JSON не сериализует BigInt нативно).
- **Circular dep PaymentsService ↔ PaymeService** — решено инжекцией TelegramService напрямую
  в PaymeService и ClickService. `handlePaymentPaid()` дублирован в обоих (enrollment + TG invite).
- **Идемпотентность платежей** — клиент генерирует `idempotency_key = crypto.randomUUID()`,
  хранится в Payment с `@@unique`. Повторный checkout с тем же ключом возвращает
  существующий платёж.
- **@Public() на webhook-эндпоинтах** — Payme/Click вызывают API без JWT.
  Аутентификация: Payme через Basic Auth (`PAYME_MERCHANT_KEY`), Click через MD5-подпись.
- **fire-and-forget `handlePaymentPaid`** — `void this.handlePaymentPaid(payment.id)`.
  Ошибки логируются, но не блокируют ответ провайдеру.
- **12ч таймаут Payme** — `PAYME_TRANSACTION_TIMEOUT_MS = 12 * 60 * 60 * 1000`.
  При PerformTransaction проверяем `Date.now() - created_at.getTime()`.
- **Click secret skip in dev** — если `CLICK_SECRET_KEY` не задан, подпись пропускается
  с `logger.warn()`. Удобно для локальной разработки.

### Проблемы и решения

- **`user.sub` vs `user.id`** — `RequestUser` интерфейс имеет `id`, а не `sub`.
  Исправлено в placement-tests.controller.ts.
- **DTO `!` (definite assignment)** — TypeScript strict mode требует явного
  инициализатора для class properties. Добавили `!` на все required DTO поля
  в lessons.controller.ts и placement-tests.controller.ts.
- **Prisma Json cast** — `payload_in: body as object` (не `Record<string, unknown>`
  который не assignable к Prisma `InputJsonValue`).
- **commitlint body-max-line-length** — строки в теле коммита не должны превышать
  100 символов. Первая попытка упала — переписали с укороченными строками.

### Следующий этап

**Этап 12 — BullMQ Telegram-уведомления**

---

## ✅ Этап 11.5 — Фискализация Soliq OFD

Дата: 13.05.2026
Статус: ✅ Завершён
Коммит в `develop`: `3d8405b` — `feat(fiscal): Этап 11.5 — Soliq OFD fiscalization with BullMQ retries`

### Что реализовано

**Новые файлы (8):**

```
apps/api/src/modules/fiscal/
├── soliq/
│   ├── soliq.types.ts           — TypeScript-интерфейсы OFD API
│   ├── soliq-auth.service.ts    — Bearer-токен кэш с EXPIRY_BUFFER_MS=60s, forceRefresh
│   └── soliq.client.ts          — HTTP-клиент, sandbox stub, retry on 401
├── fiscal-receipt.builder.ts    — buildSale/buildRefund → SoliqSendReceiptRequest
├── jobs/
│   └── fiscal-send.processor.ts — BullMQ @Processor, 6 попыток, custom backoff
├── fiscal.service.ts            — оркестратор: enqueue, getReceipt, retryReceipt
├── fiscal.controller.ts         — GET /fiscal/receipt/:id, by-payment, POST retry
└── fiscal.module.ts             — BullModule.registerQueue + все провайдеры
```

**Изменённые файлы (5):**

```
apps/api/src/modules/payments/payme/payme.service.ts   — void fiscal.scheduleReceipt после PAID
apps/api/src/modules/payments/click/click.service.ts   — void fiscal.scheduleReceipt после PAID
apps/api/src/modules/payments/payments.service.ts      — void fiscal.scheduleRefundReceipt после REFUNDED
apps/api/src/modules/payments/payments.module.ts       — import FiscalModule
apps/api/src/app.module.ts                             — BullModule.forRootAsync + FiscalModule
```

**ENV добавлены в `.env.example`:**

```
SOLIQ_API_URL=https://ofd.soliq.uz
SOLIQ_SANDBOX_URL=https://ofd-test.soliq.uz
SOLIQ_USE_SANDBOX=true
SOLIQ_CLIENT_ID=
SOLIQ_CLIENT_SECRET=
SOLIQ_TIN=
SOLIQ_TERMINAL_ID=
SOLIQ_VAT_RATE=12
```

### Архитектурные решения

- **Sandbox stub без credentials** — `SOLIQ_USE_SANDBOX=true` && `!SOLIQ_CLIENT_SECRET`
  → SoliqClient возвращает `{ success: true, receiptId: 'sandbox-{Date.now()}' }` без HTTP.
  Локальная разработка без Soliq-аккаунта работает полностью.
- **Custom BullMQ backoff** — `backoffStrategy: (attemptsMade) => RETRY_DELAYS_MS[attemptsMade-1]`
  Задержки: 1м / 5м / 30м / 2ч / 12ч / 24ч (6 попыток итого).
- **Идемпотентность заданий** — `jobId = fiscal-{paymentId}-SALE/REFUND` — BullMQ не добавит
  дубль если job с таким ID уже в очереди.
- **fire-and-forget** — `void this.fiscal.scheduleReceipt(payment.id)` в Payme/Click.
  Ошибки логируются, не блокируют ответ провайдеру (< 30s timeout).
- **Нет circular dependency** — FiscalModule не импортирует PaymentsModule.
  PaymentsModule импортирует FiscalModule (одна сторона).
- **BigInt→number в builder** — `Number(payment.amount_tiyin)` безопасно:
  тийины < Number.MAX_SAFE_INTEGER (~9×10¹⁵ = ~90 млрд UZS).
- **Token cache + forceRefresh** — SoliqAuthService хранит Bearer токен,
  обновляет за 60s до истечения. On 401 → `forceRefresh()` + 1 retry.
- **FiscalReceipt CONFIRMED/REFUNDED = терминальные** — процессор пропускает
  задания для завершённых чеков (idempotency в воркере).

### Эндпоинты

| Method | Path                                    | Auth   | Описание                  |
| ------ | --------------------------------------- | ------ | ------------------------- |
| `GET`  | `/fiscal/receipt/:id`                   | JWT    | Статус чека по ID         |
| `GET`  | `/fiscal/receipt/by-payment/:paymentId` | JWT    | Статус чека по payment_id |
| `POST` | `/fiscal/receipt/:id/retry`             | ADMIN+ | Ручной ретрай FAILED-чека |

### BullMQ поток

```
Payment → PAID
  └→ void fiscal.scheduleReceipt(paymentId)
       └→ FiscalReceipt(PENDING) создан
       └→ BullMQ job: fiscal-{paymentId}-SALE (attempts=6)
            └→ FiscalSendProcessor.process()
                 ├─ load Payment + FiscalReceipt
                 ├─ skip if CONFIRMED/REFUNDED (idempotent)
                 ├─ attempts++
                 ├─ FiscalReceiptBuilder.buildSale()
                 ├─ SoliqClient.sendReceipt()
                 │    ├─ sandbox stub → { success: true, receiptId: 'sandbox-...' }
                 │    └─ real → Bearer auth + POST /receipt
                 ├─ success → FiscalReceipt(CONFIRMED) + fiscal_sign
                 └─ error → FiscalReceipt(FAILED) + last_error → throw → retry
```

### Проблемы и решения

- **TS2769: `backoffStrategy` возвращает `number | undefined`** — `RETRY_DELAYS_MS[x]`
  выводится как `number | undefined`. Исправлено: `const last = RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] as number;`
  затем `return RETRY_DELAYS_MS[attemptsMade - 1] ?? last;`
- **WorkerHost DI** — первая попытка с `useFactory` в providers — неверно.
  Исправлено: `FiscalSendProcessor` напрямую в providers (NestJS BullMQ обрабатывает автоматически).
- **msgpackr-extract native build** — `ERR_PNPM_IGNORED_BUILDS` для `msgpackr-extract@3.0.3`.
  Исправлено: добавлен в `allowBuilds` и `onlyBuiltDependencies` в `pnpm-workspace.yaml`.

### Зависимости

```json
{ "bullmq": "^5.x", "@nestjs/bullmq": "^10.x" }
```

### Что осталось (для продакшена)

- Получить реальные credentials от Soliq OFD: `SOLIQ_CLIENT_ID`, `SOLIQ_CLIENT_SECRET`, `SOLIQ_TERMINAL_ID`
- Уточнить ИКПУ (spic=`10401010001000000`) для образовательных услуг у Soliq
- R2 upload PDF-чека (опционально, `receiptUrl` уже сохраняется если OFD его вернёт)

---

## ✅ Этап 12 — BullMQ Telegram-уведомления

Дата: 14.05.2026
Статус: ✅ Завершён
Коммит в `develop`: `2797f24` — `feat(notifications): Этап 12 — BullMQ notification queue`

### Что реализовано

**Новые файлы:**

```
apps/api/src/modules/notifications/
├── notification.types.ts               — NotificationType enum + NotificationJobData + DEDUP_TTL
├── notifications.service.ts            — фасад: schedule* методы + private enqueue()
├── jobs/
│   └── notification-send.processor.ts — BullMQ @Processor, 3 попытки exp backoff 5s
└── notifications.module.ts             — BullModule.registerQueue('notifications')
```

**`notification.types.ts`:**

- `NOTIFICATIONS_QUEUE = 'notifications'`
- `NotificationType` enum: PAYMENT_CONFIRMED, PAYMENT_REFUNDED, LESSON_REMINDER,
  HOMEWORK_NEW, GRADE_RECEIVED, PARENT_CHILD_ABSENT, PARENT_CHILD_HOMEWORK_NEW,
  PARENT_CHILD_GRADE_RECEIVED
- `NotificationJobData` interface: type, userId, title, body, dedupKey?, dedupTtlSec?, payload?
- `DEDUP_TTL` map: payment-related 86400s, lesson reminder 7200s, grade 3600s

**`notification-send.processor.ts` — алгоритм process():**

1. Проверяем Redis SETEX dedup key → если существует, skip (не посылаем повторно)
2. Загружаем User (telegram_user_id, tg_blocked) → если нет telegram_user_id или tg_blocked=true → skip
3. Создаём Notification запись в БД (sent_at = null)
4. Отправляем HTML через TelegramService.sendMessage(Number(telegram_user_id), html)
5. Обновляем sent_at = now()
6. Ставим Redis SETEX с TTL из job.data.dedupTtlSec

**`notifications.service.ts` — public методы:**

- `schedulePaymentConfirmed(paymentId, userId, amountTiyin)` — сумма в UZS
- `schedulePaymentRefunded(paymentId, userId, amountTiyin)`
- `scheduleLessonReminder(lessonId, classId, scheduledAt)`:
  - `delay = scheduledAt.getTime() - 3_600_000 - Date.now()` (за 1 час)
  - skip если delay <= 0 (урок уже начался или < 1ч)
  - загружает класс + ACTIVE enrollments → enqueue delayed job для каждого студента
- `scheduleHomeworkNew(classId, homeworkId, title)`:
  - загружает ACTIVE enrollments → enqueue для каждого студента
- `notifyParentsOfAbsent(childId, childName, classTitle, lessonDate)`
- `notifyParentsOfHomeworkNew(childId, childName, classTitle, homeworkId, hwTitle)`
- `notifyParentsOfGrade(childId, childName, submissionId, hwTitle, grade, feedback?)`
- `private getParentsOf(childId)` → `prisma.parentChildLink.findMany()`
- `private enqueue(data, opts?)` → `queue.add('send', data, { attempts:3, backoff: { type:'exponential', delay:5000 } })`

**Интеграция с существующими модулями:**

- `LessonsModule` → импортирует NotificationsModule:
  - `createLesson()`: `void this.notifications.scheduleLessonReminder(...)`
  - `bulkAttendance()`: фильтрует ABSENT, `void this.notifications.notifyParentsOfAbsent(...)`
- `HomeworkModule` → импортирует NotificationsModule:
  - `create()`: `void this.notifications.scheduleHomeworkNew(...)` (ОДИН вызов, не в loop)
  - `grade()`: `void notifications.send(grade received)` + `void notifications.notifyParentsOfGrade(...)`
- `PaymentsModule` (payme + click + payments) → импортирует NotificationsModule:
  - После PAID: `void this.notifications.schedulePaymentConfirmed(...)`
  - После REFUNDED: `void this.notifications.schedulePaymentRefunded(...)`

### Архитектурные решения

- **Redis SETEX dedup** — `notif:dedup:{type}:{entityId}:{userId}` с TTL.
  Одна оплата → одно уведомление, даже если провайдер вызовет webhook дважды.
- **fire-and-forget** — `void this.notifications.schedule*(...)` во всех триггерах.
  Провайдер не ждёт отправки; ошибки BullMQ логируются + retry.
- **Нет circular dep** — NotificationsModule не импортирует PaymentsModule.
  Односторонняя зависимость.
- **N² bug исправлен** — `scheduleHomeworkNew` вызывается ОДИН раз (сам загружает студентов).
  Родительские уведомления (`notifyParentsOfHomeworkNew`) вызываются в loop по студентам — ок,
  т.к. это один вызов на студента, каждый возвращает уже конкретного ребёнка.

---

## ✅ Этап 12.5 — Модуль «Родители»

Дата: 14.05.2026
Статус: ✅ Завершён
Коммит в `develop`: `c3b9263` — `feat(parents): Этап 12.5 — Parents module with invite flow`

### Что реализовано

**Prisma — новые модели:**

```prisma
model ParentChildLink {
  id         String   @id @default(cuid())
  parent_id  String
  child_id   String
  created_at DateTime @default(now())
  parent     User     @relation("ParentLinks", fields: [parent_id], references: [id], onDelete: Cascade)
  child      User     @relation("ChildLinks",  fields: [child_id],  references: [id], onDelete: Cascade)
  @@unique([parent_id, child_id])
  @@index([parent_id])
  @@index([child_id])
}
model ParentLinkInvite {
  id         String    @id @default(cuid())
  parent_id  String
  code       String    @unique @default(cuid())
  expires_at DateTime
  used_at    DateTime?
  child_id   String?
  parent     User      @relation("ParentInvites", fields: [parent_id], references: [id], onDelete: Cascade)
  @@index([parent_id])
  @@index([expires_at])
}
```

Миграция: `20260513060000_add_parents/migration.sql`

**`parents.service.ts` — методы:**

- `createInvite(parentId)`:
  - Проверяет: родитель уже имеет ≤ 10 детей (иначе 400)
  - Инвалидирует прошлые pending инвайты (sets `expires_at = now()`)
  - Создаёт запись с `expires_at = now() + 24h`, уникальный `code = cuid()`
  - Возвращает `{ code, expires_at }`
- `acceptInvite(code, childId)`:
  - Ищет инвайт: `code`, `expires_at > now()`, `used_at = null`
  - Проверяет: у ребёнка ≤ 5 родителей (иначе 400)
  - Проверяет `@@unique([parent_id, child_id])` — не создать дубль (409)
  - `prisma.$transaction([createLink, markInviteUsed])` — атомарно
- `getChildren(parentId)` — список детей с `active_classes` через enrollments
- `unlinkChild(parentId, childId)` — удаляет ParentChildLink
- `getChildSchedule/Homework/Attendance/Progress(parentId, childId)` — все вызывают `assertAccess()` first
- `private assertAccess(parentId, childId)` — throws ForbiddenException если нет link

**`parents.controller.ts` — эндпоинты:**

| Method   | Path                                    | Роль    | Описание                 |
| -------- | --------------------------------------- | ------- | ------------------------ |
| `POST`   | `/parents/invite`                       | PARENT  | Создать инвайт-код (24ч) |
| `POST`   | `/parents/invite/:code/accept`          | STUDENT | Принять инвайт           |
| `GET`    | `/parents/children`                     | PARENT  | Список детей             |
| `DELETE` | `/parents/children/:childId`            | PARENT  | Отвязать ребёнка         |
| `GET`    | `/parents/children/:childId/schedule`   | PARENT  | Расписание ребёнка       |
| `GET`    | `/parents/children/:childId/homework`   | PARENT  | ДЗ ребёнка               |
| `GET`    | `/parents/children/:childId/attendance` | PARENT  | Посещаемость ребёнка     |
| `GET`    | `/parents/children/:childId/progress`   | PARENT  | Прогресс ребёнка         |

**`app.module.ts`** — добавлен `ParentsModule`.

### Проблемы и решения

- **Prisma client не знает новых моделей** — после добавления схемы TypeScript давал
  `Property 'parentChildLink' does not exist on type 'PrismaService'`.
  Решение: `npx prisma generate` в `apps/api`.

---

## ✅ Этап 12.7 — Личный кабинет учителя в TWA

Дата: 14.05.2026
Статус: ✅ Завершён
Коммит в `develop`: `86f5372` — `feat(teacher): Этап 12.7 — Teacher TWA cabinet`

### Что реализовано

**Backend — ClassesModule новые эндпоинты:**

```
GET  /classes/my               — классы учителя (TEACHER/MANAGER/ADMIN)
GET  /classes/:classId/students — активные студенты класса (TEACHER+)
```

`ClassesService.getMyClasses(userId, role)`:

- Для TEACHER: найти Teacher-запись → классы с `latest_lesson` (take:1, orderBy scheduled_at desc)
  и `enrolled_count` (filter ACTIVE enrollments)
- Для остальных: вернуть все классы

`ClassesService.getClassStudents(classId)`:

- ACTIVE enrollments с `include: { student }`, `orderBy: { enrolled_at: 'asc' }`

⚠️ Оба метода помещены ДО роута `/:id` в контроллере — иначе `'my'` парсится как ID.

**Frontend — `apps/web/src/api/teacher.ts`:**

Типы: `TeacherClass`, `TeacherStudent`, `TeacherLesson`, `TeacherAttendanceRecord`,
`TeacherHomework`, `TeacherSubmission`, `CreateLessonPayload`, `CreateHomeworkPayload`,
`BulkAttendancePayload`, `GradePayload`

Query hooks: `useMyClasses`, `useClassStudents`, `useClassLessons`, `useLessonAttendance`,
`useClassHomework`, `useHomeworkSubmissions`

Mutation hooks: `useCreateLesson(classId)`, `useCreateHomework(classId)`,
`useBulkAttendance(lessonId)`, `useGradeSubmission(homeworkId)`
— все с `queryClient.invalidateQueries` на нужные ключи.

**Frontend — страницы:**

- `pages/teacher/TeacherHome.tsx`:
  - Список классов: флаг языка, название, уровень, дни расписания, enrolled_count/max_students
  - Цветная точка последнего урока (зелёная=COMPLETED, синяя=SCHEDULED)
  - Клик → `/teacher/class/:id`

- `pages/teacher/TeacherClass.tsx`:
  - 3 sticky вкладки: Уроки | Студенты | ДЗ
  - Уроки: карточки (тема, дата/время UTC+5, статус-бейдж); "+ Добавить урок" → modal (title, date, time)
  - Студенты: список с аватаром-инициалами
  - ДЗ: карточки (название, срок, truncated description); "+ Создать ДЗ" → modal
  - `WebApp.BackButton.show()` + navigate('/teacher')

- `pages/teacher/TeacherAttendance.tsx`:
  - classId из URL search params (`?classId=...`)
  - `useEffect` инициализирует statusMap: default PRESENT, override из существующих записей
  - 2×2 grid: PRESENT/ABSENT/LATE/EXCUSED для каждого студента
  - Fixed save button с `useBulkAttendance` → haptic + navigate(-1)

- `pages/teacher/TeacherSubmissions.tsx`:
  - Список сданных работ: имя студента, дата, text_answer (серый блок), file_url, grade badge
  - Не оценённые: purple "Выставить оценку" → modal (grade 0-100, feedback textarea)
  - `useGradeSubmission` mutation

**`App.tsx`** — новые роуты + role-based fallback:

```tsx
<Route path="/teacher"                                element={<TeacherHomePage />} />
<Route path="/teacher/class/:classId"                 element={<TeacherClassPage />} />
<Route path="/teacher/lesson/:lessonId/attendance"    element={<TeacherAttendancePage />} />
<Route path="/teacher/homework/:homeworkId/submissions" element={<TeacherSubmissionsPage />} />
<Route path="*" element={<Navigate to={role === 'TEACHER' ? '/teacher' : '/'} replace />} />
```

`isFullscreen` включает все `/teacher/` sub-routes — BottomNav скрыт.

**`BottomNav.tsx`** — role-based навигация:

```tsx
const isTeacher = role === 'TEACHER' || role === 'MANAGER';
const teacherItems = [
  { to: '/teacher', label: 'Классы', icon: <BookIcon /> },
  { to: '/schedule', ... },
  { to: '/profile', ... },
];
const items = isTeacher ? teacherItems : studentItems;
```

### Проблемы и решения

- **`orderBy: { created_at }` в Enrollment не существует** — нет такого поля.
  Исправлено на `orderBy: { enrolled_at: 'asc' }`.
- **`e.student` не доступен без include** — findMany без include → нет `.student`.
  Добавлен `include: { student: { select: {...} } }`.
- **Конфликт маршрута `/classes/my` vs `/:id`** — `my` парсится как id.
  Решение: поместить `@Get('my')` перед `@Get(':id')` в контроллере.

---

## ✅ Этап 12.9 — Onboarding + Retention

Дата: 14.05.2026
Статус: ✅ Завершён
Коммит: `b593a1f` — `feat(onboarding): Этап 12.9 — Onboarding + Retention`

### Что реализовано

**Backend — расширение NotificationType (+3 типа):**

- `WELCOME` — приветствие при первом логине (dedup TTL 1 год)
- `RETENTION_REMINDER` — неактивный студент > 7 дней (dedup TTL 24ч)
- `HOMEWORK_OVERDUE` — просроченное несданное ДЗ (dedup TTL 12ч)

**NotificationsService новые методы:**

- `scheduleWelcome(userId, firstName)` — красивое HTML TG-сообщение с пунктами
- `scheduleRetentionReminder(userId)` — загружает `last_active_at`, считает `daysAgo`
- `scheduleHomeworkOverdueReminder(userId, hwTitle)` — напоминание о конкретном ДЗ

**RetentionProcessor:**

- `@Processor(RETENTION_QUEUE)`, обрабатывает `{ campaign }` jobs
- `runInactiveStudentsCampaign()`: `last_active_at < 7 дней`, ACTIVE enrollments, limit 100
- `runHomeworkOverdueCampaign()`: `due_date < now`, не GRADED, limit 20 ДЗ за запуск

**NotificationsModule `onModuleInit`:**

- Регистрирует `RETENTION_QUEUE`
- Добавляет repeatable BullMQ jobs (cron pattern):
  - `inactive_students` → `0 10 * * *` UTC (15:00 Ташкент)
  - `homework_overdue` → `0 7 * * *` UTC (12:00 Ташкент)
- Стабильный `jobId` → нет дублей при рестарте

**AuthService — welcome trigger:**

- `void this.notifications.scheduleWelcome(user.id, user.first_name)` после upsert
- Dedup по userId с TTL 365 дней → один welcome per lifetime

**Frontend — `pages/Onboarding.tsx`:**

- 3-слайдный welcome-оверлей (fixed, z-50)
- Gradient-иконки, dots-навигация, «Пропустить»
- После: `WebApp.CloudStorage.setItem('onboarding_done', 'done')`

**Frontend — `api/placement-tests.ts`:**

`useStartTest`, `useAnswerQuestion(testId)`, `useCompleteTest(testId)`, `useMyTests`

**Frontend — `pages/PlacementTest.tsx`:**

3 экрана: language_select → in_progress (вопросы + прогресс-бар) → result (CEFR + score)

**Frontend — `App.tsx`:**

- Route `/placement-test` (fullscreen)
- CloudStorage check `onboarding_done` при mount → `<Onboarding>` overlay

**Frontend — `Profile.tsx`:**

- Пункт «🎯 Тест уровня языка» → `/placement-test`

### Архитектурные решения

- **Welcome dedup по TTL 1 год** вместо поля `is_onboarded` в БД — нет миграции
- **CloudStorage** для onboarding tracking — переживает пересоздание WebView-кэша
- **BullMQ repeatable jobs** вместо `@nestjs/schedule` — нет доп. зависимости
- **Retention limit 100/run** — не перегружаем TG Bot API (30 msg/s)

---

## ✅ Этап 13 — Админка v2 (Next.js)

**Дата:** 14.05.2026  
**Коммит:** `8bbc531`

### Что сделано

#### API (`apps/api/`)

**AuditLog:**

- Prisma модель `AuditLog` добавлена в schema.prisma (actor_id, action, entity_type, entity_id, meta, created_at)
- Миграция `20260514_add_audit_log` создана вручную (без running DB)
- `AuditModule` + `AuditService`: `log()` (fire-and-forget через void) + `list()` с пагинацией
- Prisma Client регенерирован: `npx prisma generate`

**AdminService** — audit logging добавлен во все write-операции:

- `deleteStudent(id, actorId)` → `audit.log('student_deleted', 'user')`
- `createTeacher(dto, actorId)` → `audit.log('teacher_created', 'teacher')`
- `deleteTeacher(id, actorId)` → `audit.log('teacher_deleted', 'teacher')`
- `createClass(dto, actorId)` → `audit.log('class_created', 'class')`
- `deleteClass(id, actorId)` → `audit.log('class_deleted', 'class')`
- `changeRole(...)` → `audit.log('role_changed', 'user', { old_role, new_role })`

**Broadcast TG:**

- `broadcast(dto, actorId)` — фильтр студентов (ACTIVE enrollment, не заблокированные), лимит 500
- Задания в BullMQ очередь через `notifications.send()` с `NotificationType.BROADCAST`
- `POST /admin/notifications/broadcast` — ADMIN+ только

**CSV Export:**

- `exportStudentsCsv()` — все студенты (id, имя, email, телефон, telegram, locale, enrollments, активность)
- `exportPaymentsCsv()` — платежи (student, class, amount UZS, provider, status, paid_at)
- `csvEscape()` — экранирование RFC 4180
- BOM `﻿` в начале — корректное открытие в Excel без настроек

**Settings:**

- `listPaymentProviders()` → `GET /admin/settings/payment-providers`
- `updatePaymentProvider(provider, dto, actorId)` → `PATCH /admin/settings/payment-providers/:provider`
- Поддерживает: `is_enabled`, `display_order`, `config` (merge с существующим)

**AdminController** — новые endpoints:

- `GET /admin/students/export` (ADMIN+, до `/:id` — NestJS route ordering!)
- `GET /admin/payments/export` (ADMIN+)
- `POST /admin/notifications/broadcast` (ADMIN+)
- `GET /admin/audit` (ADMIN+)
- `GET /admin/settings/payment-providers` (ADMIN+)
- `PATCH /admin/settings/payment-providers/:provider` (ADMIN+)

**AdminModule** — добавлены imports: `AuditModule`, `NotificationsModule`, `TelegramModule`

**notification.types.ts** — добавлен `NotificationType.BROADCAST = 'broadcast'`

#### Admin UI (`apps/admin/`)

**Proxy routes:**

- `app/api/proxy/audit/route.ts` — GET → API /admin/audit
- `app/api/proxy/broadcast/route.ts` — POST → API /admin/notifications/broadcast
- `app/api/proxy/students/export/route.ts` — GET → пробрасывает CSV response
- `app/api/proxy/payments/export/route.ts` — GET → пробрасывает CSV response
- `app/api/proxy/settings/payment-providers/route.ts` — GET
- `app/api/proxy/settings/payment-providers/[provider]/route.ts` — PATCH

**Новые страницы:**

- `app/audit/page.tsx` — Server Component, таблица событий с пагинацией (ACTION_LABEL map)
- `app/broadcast/page.tsx` — Client Component, форма с confirm dialog, счётчик символов
- `app/export/page.tsx` — Client Component, кнопки скачивания CSV через `window.location.href`
- `app/settings/page.tsx` — Client Component, toggle-переключатели + display_order input

**Дашборд `app/page.tsx`** — добавлены 4 карточки: Рассылка, Экспорт, Журнал аудита, Настройки

### Архитектурные решения

- **AuditLog fire-and-forget**: `void this.audit.log(...)` — аудит не должен ломать основной поток
- **No `@nestjs/schedule`**: BullMQ repeatable jobs в NotificationsModule.onModuleInit (уже с Этапа 12)
- **CSV без зависимостей**: ручная генерация + `csvEscape()` по RFC 4180, BOM для Excel
- **Route ordering**: `students/export` ВЫШЕ `students/:id` — иначе NestJS захватит 'export' как param
- **BigInt в CSV**: `Number(p.amount_tiyin)` — безопасно для UZS суммы (не превышает 2^53)

---

## 🔄 Этап 21 — Liquid Glass редизайн (apps/portal)

**Статус:** в процессе

### Цель

Редизайн `apps/portal` (студент + учитель) в стиле Liquid Glass — glassmorphism с blur, ambient gradients, inset shadows. Дизайн-система копируется из проекта FlowerShop (`C:\Users\Muzaffar\Desktop\Projects\SERVICES\flowershop`).

### Параметры

- **Приложение:** `apps/portal` (Next.js 16)
- **Цвет:** Emerald (зелёный акцент)
- **Тема:** Pearl (светлая) + Nuar (тёмная) с переключателем

### FlowerShop дизайн-система (источник)

- **Blur:** 56px (standard), 64px (cards), 44px (pills/inputs)
- **Backdrop-filter:** `blur(Xpx) saturate(220%) brightness(1.08)`
- **Glass bg:** Pearl — `rgba(255,255,255,0.55)` | Nuar — `rgba(255,255,255,0.012)`
- **Inset bevel:** `inset 0 1.5px 0 rgba(255,255,255,0.12)` top + `inset 0 -1px 0 rgba(0,0,0,0.07)` bottom
- **Ambient glows:** 3 floating gradient circles (g1/g2/g3) как фон
- **Кнопки:** solid accent + glow shadow + scale(0.98) active

### Этапы

| Этап | Задача                                                                 | Статус |
| ---- | ---------------------------------------------------------------------- | ------ |
| A    | Glass CSS система — переменные, blur классы, Pearl/Nuar темы с emerald | ⏳     |
| B    | `BottomNav.tsx` — glass pill, 4 таба (Главная/Курсы/Уроки/Профиль)     | ⏳     |
| C    | `Nav.tsx` — glass top bar с blur                                       | ⏳     |
| D    | Dashboard `/` — ambient bg + glass stat cards                          | ⏳     |
| E    | `/courses` — glass course cards с level badge                          | ⏳     |
| F    | `/lessons`, `/homework`, `/payments` — glass list items                | ⏳     |
| G    | `/teacher/*` — emerald-tinted glass (`glass-option-green`)             | ⏳     |
| H    | ThemeStore + переключатель тем в профиле                               | ⏳     |

---

## ✅ Этап 13.5 — Аналитика

**Дата:** 14.05.2026 | **Коммит:** `aa74010`

- `GET /admin/analytics/revenue?months=N` — выручка PAID по месяцам (`$queryRaw` + `date_trunc`)
- `GET /admin/analytics/students?months=N` — новые студенты по месяцам
- `GET /admin/analytics/enrollments` — воронка: by_status + funnel_monthly (6 мес.)
- Admin UI `/analytics` — BarChart выручки, LineChart студентов, BarChart stacked воронки, PieChart статусов
- Переключатель периода 3/6/12 месяцев, KPI-карточки
- recharts установлен в `@linguolab/admin`

---

## ✅ Этап 14 — Тесты + CI/CD финал

### Юнит-тесты (Этап 14)

**Дата:** 14.05.2026

#### Созданные spec-файлы

- pps/api/src/modules/audit/**tests**/audit.service.spec.ts
  - log() создаёт запись с корректными аргументами
  - entity_id=null если не передан
  - Ошибка Prisma поглощается (fire-and-forget)
  - list() возвращает items/total/page/pages
  - skip=100 для page=3, limit=50
  - Фильтры actorId/action/entityType
  - pages=ceil(51/50)=2

- pps/api/src/modules/admin/**tests**/admin.service.spec.ts
  - exportStudentsCsv(): заголовок, строка студента, экранирование запятых
  - exportPaymentsCsv(): BigInt → сум (÷100), заголовок
  - broadcast(): BadRequestException на пустое/пробелы, queued count, send×N
  - dashboardWidgets(): все 7 KPI метрик

- pps/api/src/modules/placement-tests/**tests**/placement-tests.service.spec.ts
  - scoreToLevel() все 8 граничных значений (0/3/4/7/9/12/14/15 правильных)
  - complete(): NotFoundException, cached COMPLETED, вычисление score
  - start(): существующий тест, NotFoundException язык, создание нового
  - answer(): NotFoundException, already_answered возвращает ok:true

**Результат:** 35/35 тестов ✅ | Исправление: jest.resetAllMocks() вместо clearAllMocks()

#### Sentry интеграция

- Установлено: @sentry/nestjs, @sentry/profiling-node
- pps/api/src/instrument.ts — init до всех импортов, enabled только при SENTRY_DSN
- pps/api/src/main.ts — import './instrument' первой строкой
- pps/api/src/app.module.ts — SentryModule.forRoot() + SentryGlobalFilter (APP_FILTER)
- pnpm-workspace.yaml — allowBuilds + onlyBuiltDependencies для node-cpu-profiler
- tracesSampleRate: prod=0.2, dev=1.0 | profilesSampleRate: prod=0.1, dev=0.0

---

## ✅ Этап 15 — Веб-кабинет студента (apps/portal)

**Дата:** 14.05.2026 | **PR:** #29 (merged)

### Что реализовано

**Приложение:** `apps/portal` (@linguolab/portal) — Next.js 16, порт 3002

**Страницы:**

- / — дашборд: мои курсы, ближайший урок, прогресс achievements
- /courses — каталог классов с фильтром по языку / уровню CEFR
- /courses/[id] — страница класса: описание, учитель, расписание, кнопка записи + оплата
- /my/lessons — расписание уроков (calendar/list view)
- /my/homework — домашние задания: список, статус, загрузка файла
- /my/payments — история платежей, статус, сумма в UZS
- /placement-test/[lang] — UI прохождения placement test (15 вопросов, таймер)
- /profile — редактирование профиля, смена locale (ru/uz/en)

**Auth:** NextAuth.js с JWT — тот же secret что у API

**Proxy:** /app/api/proxy/_ → API_URL/api/v1/_ (как в apps/admin)

**Стек:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, next-intl (i18n ru/uz/en)
**Стек:** Next.js 16, TypeScript, Tailwind CSS 4, NextAuth v4

---

## ✅ Этап 16 — Веб-портал учителя (apps/portal/teacher)

**Статус:** выполнен | PR #30

### Что сделано

Раздел /teacher/\* внутри apps/portal (Next.js 16 App Router) для учителей.

**Страницы:**

- /teacher — дашборд (Server Component): мои классы + ближайшие 5 уроков; role guard TEACHER
- /teacher/classes/[id] — список студентов с enrollment status
- /teacher/classes/[id]/lessons — управление уроками: список + create form (datetime-local)
- /teacher/classes/[id]/homework — выдача ДЗ + оценка (grade 0-100 + feedback); статусы SUBMITTED/LATE/GRADED
- /teacher/schedule — Server Component: предстоящие уроки (до 20) + история (до 10)
- TeacherNav — emerald-themed nav компонент с «Учитель» badge

**API proxy routes** (apps/portal/src/app/api/proxy/teacher/):

- GET/POST /teacher/classes/[id]/lessons → /api/v1/lessons/class/:id / /api/v1/lessons
- GET/POST /teacher/classes/[id]/homework → /api/v1/homework/class/:id + submissions параллельно
- PATCH /teacher/homework/[id] → /api/v1/homework/submissions/:id/grade

**Auth:** тот же NextAuth, role=TEACHER → middleware + серверный redirect

**Технические заметки:**

- params теперь Promise (Next.js 16) — везде await params
- GradeHomeworkDto: grade: number (0-100), не status APPROVED/REJECTED
- tsc --noEmit: 0 ошибок

---

## ✅ Этап 17 — E2E тесты (Playwright)

**Статус:** выполнен | PR #31

### Что сделано

Playwright smoke-тесты критических пользовательских флоу.

**Инфраструктура apps/e2e/:**

- mock-server/index.mjs — Node.js HTTP mock backend на порту 9999, обрабатывает все /api/v1/\* маршруты
- playwright.config.ts — webServer запускает mock API + portal; API_URL=http://localhost:9999
- tests/helpers/auth.ts — encode() NextAuth JWE cookie для Server Components + mock /api/auth/session
- .github/workflows/e2e.yml — отдельный CI job (main), собирает portal, устанавливает Chromium, артефакт отчёт

**Тест-кейсы (4 spec-файла):**

- auth.spec.ts: логин форма, валидация, ошибка при неверных данных
- student.spec.ts: dashboard, курсы, уроки, ДЗ, платежи, профиль
- teacher.spec.ts: дашборд, класс+студенты, создание урока, оценка ДЗ (→GRADED), расписание
- placement.spec.ts: полный флоу 15 вопросов → результат CEFR B1

**Технические решения:**

- Server Components работают т.к. JWT cookie кодируется с тем же NEXTAUTH_SECRET
- Все /api/proxy/\* вызовы идут через mock server (API_URL) — браузерный page.route() не нужен
- E2E CI job отделён от unit-test CI (triggers только на main)

---

## ✅ Этап 18 — Docker + Production деплой

**Статус:** выполнен | PR #32

### Что сделано

Production-ready контейнеризация всех сервисов (API + admin + portal).

**Уже было (из предыдущих этапов):**

- apps/api/Dockerfile — multi-stage NestJS (pnpm deploy --prod, tini, healthcheck)
- apps/admin/Dockerfile — Next.js standalone, port 3001
- infra/compose/docker-compose.yml — postgres + redis + api + admin
- infra/nginx/conf.d/ — api, admin, app (TWA) конфиги
- deploy-api.yml, deploy-admin.yml, deploy-web.yml workflows

**Добавлено в Этапе 18:**

- apps/portal/next.config.ts: output: 'standalone'
- apps/portal/Dockerfile — deps→builder→runtime (alpine+tini, port 3002, API_URL ARG)
- infra/compose/docker-compose.yml: linguolab_portal сервис (GHCR image, API_URL internal, healthcheck)
- infra/nginx/conf.d/portal.linguolab.conf: portal-linguolab.muzaffarbahodir.uz → :3002
  immutable cache на /\_next/static/, security headers
- .github/workflows/deploy-portal.yml: build+push GHCR → SSH inject NEXTAUTH_SECRET → docker compose up

**Production stack:**

- postgres:16-alpine + redis:7-alpine (internal network)
- linguolab_api:3000, linguolab_admin:3001, linguolab_portal:3002
- nginx (shared_web network) → SSL termination → proxy_pass
- GHCR registry для всех образов

---

## ✅ Этап 19 — Безопасность + Производительность

**Статус:** выполнен | PR #33

### Что сделано

**Безопасность (apps/api):**

- Helmet.js в main.ts: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
  crossOriginEmbedderPolicy: false для Telegram Web App iframe
- ThrottlerModule (@nestjs/throttler): 20 req/sec + 300 req/min
  skipIf: NODE_ENV===test — unit-тесты не затронуты
- ThrottlerGuard первый APP_GUARD (до JWT — блокирует до auth-проверки)

**Redis кэш (apps/api):**

- LanguagesService.findAll() → cache:languages TTL 5 мин
- ClassesService.findAll() → cache:classes:{lang}:{level} TTL 5 мин
- RedisService @Global() — инъекция без импорта модуля

**Производительность (apps/portal):**

- /courses: export const revalidate = 60 (Next.js ISR 60s)

**Результаты:**

- jest: 47/47 passed
- tsc --noEmit: 0 errors (api + portal)
- BullMQ concurrency tuning для notifications воркера

---

## ✅ Этап 20 — Production запуск

**Статус:** выполнен | PR #34

### Что сделано

Полный production launch runbook и шаблон переменных окружения.

**Файлы:**

- `LAUNCH.md` — runbook: env vars, DNS, SSL, деплой, миграции, Telegram webhook, бэкапы, мониторинг, smoke tests, rollback, security checklist
- `infra/compose/.env.example` — шаблон всех переменных окружения с комментариями (PostgreSQL, Redis, JWT, NextAuth, Telegram, Sentry, Payme, Click, Uzum, OFD, S3)

**Чеклист:**

- [x] DATABASE_URL → prod Postgres
- [x] REDIS_URL → prod Redis
- [x] SENTRY_DSN заполнен, ошибки приходят
- [x] Telegram Bot webhook → prod URL
- [x] Payme/Click/Uzum credentials → prod аккаунты
- [x] Soliq OFD → prod (USE_SANDBOX=false)
- [x] DNS записи настроены
- [x] SSL сертификаты получены
- [x] Backup стратегия БД (pg_dump cron, ротация 30 дней)
- [x] Smoke-тест после деплоя (curl checklist в LAUNCH.md)
- [x] Мониторинг uptime (UptimeRobot — /health endpoint)
- [x] Rollback procedure задокументирован

### Архитектурные решения

- `.env.example` в git (шаблон), `.env` в `.gitignore` (секреты)
- pg_dump через docker exec — не требует psql на хосте
- Backup retention 30 дней через `find -mtime +30 -delete`
- Smoke tests curl-based — не зависят от браузера/Node.js

---

## 🔄 Этап 21 — Liquid Glass редизайн (apps/portal)

**Статус:** в процессе | ветка `feat/etap-21-glass`

### Цель

Редизайн `apps/portal` в стиле Liquid Glass — glassmorphism с blur, ambient gradients, inset shadows. Дизайн-система скопирована из FlowerShop.

**Параметры:** Emerald акцент · Pearl (светлая) + Nuar (тёмная) темы с переключателем

### Прогресс

| Этап | Задача                                                                 | Статус |
| ---- | ---------------------------------------------------------------------- | ------ |
| A    | Glass CSS система — переменные, blur классы, Pearl/Nuar темы с emerald | ✅     |
| B    | `BottomNav.tsx` — glass pill, 4 таба (Главная/Курсы/Уроки/Профиль)     | ✅     |
| C    | `Nav.tsx` — glass top bar с blur                                       | ✅     |
| D    | Dashboard `/` — ambient bg + glass stat cards                          | ✅     |
| E    | `/courses` — glass course cards с level badge                          | ✅     |
| F    | `/lessons`, `/homework`, `/payments` — glass list items                | ✅     |
| G    | `/teacher/*` — emerald-tinted glass                                    | ✅     |
| H    | ThemeToggle в профиле                                                  | ✅     |

### Этап 21A — Glass CSS система

- `apps/portal/src/styles/glass.css` — `.glass`, `.glass-card`, `.glass-pill`, `.glass-section`, `.glass-emerald`, `.glass-option-*`, `.glass-btn`, `.glass-input`, анимации
- `apps/portal/src/lib/glass-theme.ts` — Pearl/Nuar темы + `applyGlassTheme()`
- `apps/portal/src/components/ThemeProvider.tsx` — Context + `ThemeToggle`
- `apps/portal/src/app/globals.css` — CSS vars (Pearl defaults, SSR-safe)
- `apps/portal/src/app/layout.tsx` + `providers.tsx` — подключены

### Этап 21B — BottomNav

- `apps/portal/src/components/BottomNav.tsx` — фиксированный glass-pill, 4 таба с SVG иконками, активный emerald highlight + dot indicator, скрыт на `/teacher/*` и `/login`
- `apps/portal/src/app/layout.tsx` — `pb-28` offset + BottomNav в root layout

### Этап 21C — Nav + TeacherNav

- `apps/portal/src/components/Nav.tsx` — glass top bar: логотип-пилюля, `ThemeToggle`, имя, выйти; sticky, max-w-lg centered
- `apps/portal/src/components/TeacherNav.tsx` — `glass-emerald` bar: badge «Учитель», таб-ссылки с active состоянием, `ThemeToggle`

### Этап 21D — Dashboard

- `apps/portal/src/app/page.tsx` — полный редизайн:
  - Hero `glass-card` — приветствие + счётчик активных курсов
  - 4 quick-link `glass-card` тайла в grid-cols-4 (Задания, Оплата, Тест уровня, Каталог)
  - Мои курсы — `glass-section` со списком активных записей + флаг языка + emerald badge
  - Ближайшие уроки — `glass-section` с временем + `fmtDate()` (ru-RU locale)
  - Empty states с `glass-btn` CTA
  - `glass-fade-in` анимация на `<main>`

### Этап 21E — Courses

- `apps/portal/src/app/courses/page.tsx` — glass список курсов:
  - Header `glass-card`, список в `glass-section` с `--glass-divider` между строками
  - Флаг языка (FLAG map по code), level badge (`glass-option-emerald/blue/red`)
  - Счётчик мест, имя учителя, стрелка `›`
- `apps/portal/src/app/courses/[id]/page.tsx` — glass детальная страница:
  - Hero `glass-card` с флагом + level badge
  - Teacher card `glass-card` с аватаром 👨‍🏫
  - Schedule `glass-section` с днями недели
  - Кнопка записи `glass-btn` + счётчик мест

### Этап 21F — My Pages (Lessons / Homework / Payments)

- `apps/portal/src/app/my/lessons/page.tsx` — предстоящие (emerald badge «Скоро») + прошедшие (opacity 0.8) в `glass-section`, ссылка записи урока emerald
- `apps/portal/src/app/my/homework/page.tsx` — status badges через `statusClass()`, `glass-btn` «Сдать задание», feedback в `glass-green-bg` div
- `apps/portal/src/app/my/payments/page.tsx` — `glass-section` список, итого оплачено emerald, status badges по типу

### Этап 21G — Teacher Pages

- `apps/portal/src/app/teacher/page.tsx` — `glass-emerald` hero, классы в `glass-section`, быстрый доступ к ДЗ
- `apps/portal/src/app/teacher/schedule/page.tsx` — предстоящие с кнопкой «Управление», история с opacity 0.8
- `apps/portal/src/app/teacher/classes/[id]/page.tsx` — класс hero + grid кнопок (Уроки/ДЗ) + список студентов с avatar-инициалом
- `apps/portal/src/app/teacher/classes/[id]/lessons/page.tsx` — форма создания с `glass-input`, список с is_completed opacity
- `apps/portal/src/app/teacher/classes/[id]/homework/page.tsx` — создание ДЗ + список сдач с grade-формой

### Этап 21H — Profile

- `apps/portal/src/app/profile/page.tsx` — avatar card + ThemeToggle card (Pearl/Nuar) + форма редактирования в `glass-section`

---

## ✅ Этап 22 — TWA-only авторизация через Telegram

**Статус:** завершён | PR #38 | ветка `feat/etap-22-twa-auth`

**Дата:** 15.05.2026

### Цель

Переключить `apps/portal` с NextAuth (логин/пароль) на авторизацию через Telegram initData.
Портал должен работать **только внутри Telegram** как TWA (Telegram Web App).
Идентификация пользователя — по `telegram_user_id` без паролей.

### Контекст — что уже есть

- ✅ `POST /auth/telegram/init` — HMAC-SHA256 валидация initData, upsert юзера, JWT (Этап 2)
- ✅ `TelegramInitDataValidator` — полная реализация алгоритма Telegram
- ✅ Роли: `STUDENT / TEACHER / MANAGER / PARENT / ADMIN / SUPER_ADMIN`
- ✅ Новый юзер → роль `STUDENT` по умолчанию
- ✅ `apps/web` уже имеет пример TWA auth (tokenHolder + axios interceptor + Zustand)
- ⚠️ `apps/portal` сейчас использует NextAuth — нужно заменить

### Прогресс

| Этап | Задача                                                           | Статус |
| ---- | ---------------------------------------------------------------- | ------ |
| 22A  | API: `is_active: false` для новых юзеров + PATCH роли для админа | ✅     |
| 22B  | Portal: заменить NextAuth → TWA auth (initData → JWT в cookie)   | ✅     |
| 22C  | Portal: TwaGuard — loading / error / pending-activation экраны   | ✅     |
| 22D  | Admin: страница управления юзерами (активация + смена роли)      | ✅     |

### Этап 22A — API изменения

**Что меняем:**

- `User.is_active` — дефолт меняем с `true` на `false` для новых юзеров (миграция)
- `PATCH /users/:id/role` — новый эндпоинт для MANAGER/ADMIN, меняет роль + инкрементирует `token_version`
- `PATCH /users/:id/activate` — активация юзера (MANAGER/ADMIN)
- `GET /users/pending` — список неактивных юзеров для админки
- При активации → `TelegramService.sendMessage` — уведомление юзеру в бот

**Файлы:**

- `apps/api/prisma/migrations/...` — `is_active` default false
- `apps/api/src/modules/users/users.controller.ts` — новые эндпоинты
- `apps/api/src/modules/users/users.service.ts` — логика активации + смены роли

### Этап 22B — Portal TWA Auth

**Что убираем:** NextAuth (`next-auth`, `providers.tsx`, `lib/auth.ts`, `/api/auth/[...nextauth]`)

**Что добавляем:**

- `apps/portal/src/lib/twa-auth.ts` — `initTwaAuth()`: читает `window.Telegram.WebApp.initData` → `POST /auth/telegram/init` → возвращает `{user, accessToken}`
- `apps/portal/src/lib/token.ts` — in-memory singleton для JWT (не localStorage — безопаснее)
- `apps/portal/src/lib/api.ts` — axios/fetch с `Authorization: Bearer` + авто-refresh при 401
- `apps/portal/src/components/AuthProvider.tsx` — Client Component, вызывает `initTwaAuth()` при mount, кладёт user в Context
- `apps/portal/src/app/layout.tsx` — убираем SessionProvider, добавляем AuthProvider

### Этап 22C — Онбординг и TWA-only guard

**TWA guard** (`apps/portal/src/components/TwaGuard.tsx`):

- Если `window.Telegram?.WebApp?.initData` пустой → показывает экран "Откройте через бот" с QR-кодом/ссылкой
- Если `user.is_active === false` → экран ожидания "Заявка отправлена, ждите подтверждения"

**Онбординг** (`apps/portal/src/app/onboarding/page.tsx`):

- Новый юзер (первый вход) → экран "Кто вы?" (Студент / Родитель)
- Форма: телефон (опционально)
- Submit → `PATCH /users/me` → уведомление админу в Telegram

### Этап 22D — Admin: управление пользователями

**Файлы:**

- `apps/admin/src/app/users/page.tsx` — таблица всех юзеров с фильтром по роли/статусу
- `apps/admin/src/app/users/[id]/page.tsx` — карточка юзера: активировать, сменить роль
- Кнопки: Активировать / Заблокировать / Роль: [select]

---

## ✅ Этап 23 — Расширенная админка в TWA

**Статус:** завершён | прямой push в `main`
**Дата:** 29.05.2026 – 30.05.2026

### Цель

Перенести админ-функционал из Next.js в TWA — все управление через одно приложение.

### Что сделано

**Новые страницы (`apps/web/src/pages/admin/`):**

- `AdminTeachers.tsx` — список с пагинацией, создать/редактировать/удалить (ADMIN+); BadgeSheet с preset-иконками (⭐🏆🎓🔥💎🌟🎯✅🚀❤️) для выдачи/удаления бейджей
- `AdminClasses.tsx` — CRUD классов с picker языка и учителя; уровни A1-C2; toggle архив; кнопка 📅 → ScheduleForm (дни недели + время + длительность)
- `AdminAnalytics.tsx` — inline SVG bar charts (без recharts) для Revenue / New Students / Enrollments funnel; period switcher 3/6/12 месяцев
- `AdminEnrollments.tsx` — фильтр PENDING/ACTIVE/DROPPED/Все, кнопки Подтвердить/Отчислить/Восстановить, WebApp.showConfirm
- `AdminCertificates.tsx` — два режима: по классу (фильтр inline) / поиск студента (через `useAdminStudents` → выбор класса → выдача)
- `AdminPaymentSettings.tsx` — toggle switches для PAYME/CLICK/UZUMBANK, сортировка по display_order
- `AdminReferrals.tsx` — 3 карточки (codes_created / redeemed / conversion_pct) + топ-10 рефереров с медалями 🥇🥈🥉

**Новые API хуки (`apps/web/src/api/admin.ts`):**

- `useAdminTeachers/Classes` + CRUD (`useCreate/Update/Delete*`)
- `useSetClassSchedule`, `useAllEnrollments`, `useUpdateEnrollmentStatus`
- `usePaymentProviders`, `useUpdatePaymentProvider`
- `useReferralStats`, `useAnalyticsEnrollments`
- `useAwardBadge`, `useRemoveBadge`, `useIssueCertificate`

**Backend изменения:**

- `apps/api/src/modules/referrals/referrals.service.ts` — `adminStats()` → total/redeemed/conversion_pct/top_referrers
- `apps/api/src/modules/referrals/referrals.controller.ts` — `GET /referrals/admin/stats` (MANAGER+)

**Routing (`apps/web/src/App.tsx`):**

- `/admin/teachers`, `/admin/classes`, `/admin/analytics`, `/admin/enrollments`
- `/admin/certificates`, `/admin/payment-settings`, `/admin/referrals`

**AdminHome (`apps/web/src/pages/admin/AdminHome.tsx`):**

- Добавлены QuickLinks с emoji + цветами; алерты для pending users/transfers/trials/tickets
- `adminOnly: true` для AdminPaymentSettings, AdminAnalytics

---

## ✅ Этап 24 — TeacherStats + полная i18n (3 языка)

**Статус:** завершён | прямой push в `main`
**Дата:** 30.05.2026

### Цель

Учитель видит сводную статистику. Все UI-строки переведены на ru / en / uz.

### Что сделано

**`TeacherStats.tsx` (`/teacher/stats`):**

- 4 карточки grid: 🎓 Классов / 👥 Студентов / 📅 Уроков / 📊 Ср. посещаемость (color-coded ≥80% / ≥60% / <60%)
- Карточка с количеством проверенных ДЗ
- Per-class breakdown: для каждого класса grid студентов с progress bar посещаемости и счётчиком ДЗ
- Кнопка 📊 на TeacherHome → переход на статистику

**i18n (`apps/web/public/locales/{ru,uz,en}/translation.json`):**

- Расширены до ~700 строк каждый файл
- Новые секции: `support`, `attendance`, `notifications`, `certificates`, `placement`, `teacher`, `parent`
- Полный раздел `admin.*`: home, users, students, teachers, classes, analytics, enrollments, certificates, trials, support, transfers, finance, broadcast, audit, payment_settings, referrals
- Применено в страницах: `Support`, `Attendance`, `AdminReferrals`, `AdminEnrollments`, `TeacherStats`, `AdminPaymentSettings`, `AdminAnalytics`, `AdminClasses`, `AdminTeachers`
- Узбекские локали: дни недели (Du/Se/Ch/Pa/Ju/Sh/Ya), форматы сумм (so'm)

---

## ✅ Этап 25 — Статусные TG-уведомления + CSV + поиск

**Статус:** завершён | прямой push в `main`
**Дата:** 30.05.2026

### Цель

Студент получает push в Telegram при изменении статуса (зачисление, тикет, сертификат). Админ экспортирует CSV и ищет студентов глобально.

### Что сделано

**Backend — `apps/api/src/modules/notifications/`:**

- `notification.types.ts` — 6 новых типов: `ENROLLMENT_CONFIRMED`, `ENROLLMENT_DROPPED`, `TRIAL_CONFIRMED`, `TRIAL_CANCELLED`, `SUPPORT_TICKET_UPDATED`, `CERTIFICATE_ISSUED`
- Добавлены DEDUP_TTL: 86400с (24ч) для status changes, 30 дней для сертификатов
- `notifications.service.ts` — 6 новых `schedule*()` методов с BullMQ enqueue + dedupKey

**Вызовы в сервисах:**

- `enrollments.service.ts` → `updateStatus()` шлёт `scheduleEnrollmentConfirmed` (ACTIVE) или `scheduleEnrollmentDropped` (DROPPED)
- `support.service.ts` → `updateStatus()` шлёт `scheduleSupportTicketUpdated` с локализованной меткой статуса
- `trial-lessons.service.ts` → `updateStatus()` шлёт `scheduleTrialConfirmed` или `scheduleTrialCancelled`
- `certificates.service.ts` → `issue()` после создания записи шлёт `scheduleCertificateIssued`

**Регистрация модулей:**

- `enrollments.module.ts`, `support.module.ts`, `trial-lessons.module.ts`, `certificates.module.ts` — все импортируют `NotificationsModule`

**CSV экспорт UI:**

- `AdminStudents.tsx` — кнопка 📥 CSV (ADMIN+) → `GET /admin/students/export` → axios responseType:'blob' → `<a download>`
- `AdminFinance.tsx` — кнопка 📥 CSV → `GET /admin/payments/export` → blob download
- Backend добавляет BOM (`﻿`) для корректного открытия в Excel

**Поиск студентов в `AdminCertificates`:**

- Tabs: «📚 По классу» / «🔍 Поиск студента»
- Режим класса: фильтр inline по имени студентов
- Режим поиска: `useAdminStudents(search)` → `FoundStudentRow` → expand → выбор класса → `handleGlobalIssue()`

---

## ✅ Этап 26 — UX полировка + Code splitting

**Статус:** завершён | прямой push в `main`
**Дата:** 29.05.2026 – 30.05.2026

### Цель

BottomSheet работает корректно (без прозрачности и багов с tab-bar). Bundle размер минимизирован через lazy loading.

### Что сделано

**`BottomSheet.tsx` — переписан полностью:**

- `createPortal(document.body)` — обход stacking context от `glass-fade-in` родителей; раньше `position: fixed` рендерилось относительно animated div, а не viewport
- `position: fixed; bottom: 0; left: 0; right: 0` без flexbox
- z-index 200 (backdrop) / 201 (sheet) — выше BottomNav (z-50)
- Backdrop `rgba(0,0,0,0.6)` (полупрозрачный, виден главный экран)
- Свайп вниз: `onTouchStart/Move/End` — `translateY(delta)`, если delta > 80px → `onClose()`, иначе spring back через transition 0.2s
- Удалён × close button, остался handle bar (4×36px)
- Убраны `env(safe-area-inset-bottom)` — на Android Samsung возвращал ~100px → огромная серая полоса снизу

**Zustand `useUIStore` (`apps/web/src/store/ui.ts`):**

```typescript
interface UIState {
  bottomSheetOpen: boolean;
  setBottomSheetOpen: (open: boolean) => void;
}
```

- BottomSheet `useEffect` синхронизирует `bottomSheetOpen` при mount/unmount
- `App.tsx` подписывается на состояние → `showBottomNav = ... && !bottomSheetOpen` → BottomNav размонтируется когда шторка открыта

**Code splitting (`App.tsx`):**

- Eager: `HomePage`, `ProfilePage`, `NotInTelegramPage`, `Onboarding` (критичные)
- Lazy: все остальные ~30 страниц через `React.lazy(() => import('./pages/X').then(m => ({ default: m.X })))`
- `<Suspense fallback={<PageLoader />}>` обёртывает `<Routes>`
- Результат: main bundle **657kb → 422kb** (-35%), gzip 168kb → 132kb

**Дополнительно:**

- `Courses.tsx` — секция «Мои заявки на пробный урок» с badge статусов (PENDING/CONFIRMED/CANCELLED)
- `Payment.tsx` — инвойс с ACTIVE enrollments + кнопка «💳 Оплатить» → checkout
- Onboarding — `showBottomNav && !showOnboarding` (раньше BottomNav перекрывал экран приветствия)
- Admin notification link — `${TELEGRAM_WEB_APP_URL}/admin/users` вместо старого `admin-linguolab.muzaffarbahodir.uz/users/pending`
- QuickActionsSheet — fix полупрозрачности через `useUIStore.bottomSheetOpen`

---

## 🗂 Текущая структура страниц TWA

### Студент (`STUDENT`)

- `Home` (`/`) — приветствие, прогресс, ближайший урок, языки, пробный урок, ⚡ QuickActions
- `Schedule` (`/schedule`) — upcoming lessons, мои классы, рейтинг учителя, transfer-кнопка, история посещений
- `Courses` (`/courses`) — заявки на пробный урок + список классов с фильтром по языку
- `Profile` (`/profile`) — аватар TG, статистика, реферальная карточка, quicklinks
- `Booking` (`/book`) — 3-шаговый stepper записи
- `Homework` (`/homework`) — список ДЗ + сдача (text + file)
- `Achievements` (`/achievements`) — медали
- `Certificates` (`/certificates`) — мои сертификаты
- `Payment` (`/payment`) — инвойс + выбор провайдера + история
- `PlacementTest` (`/placement-test`) — тест уровня
- `Notifications` (`/notifications`) — уведомления
- `Support` (`/support`) — тикеты поддержки (создать + список с badge статусов)
- `Attendance` (`/attendance`) — посещаемость по классам с reminder hint

### Учитель (`TEACHER`)

- `TeacherHome` (`/teacher`) — сегодняшние уроки + ДЗ на проверке + мои классы + edit-profile sheet
- `TeacherClass` (`/teacher/class/:id`) — вкладки Уроки/Студенты/ДЗ + generate lessons
- `TeacherStudentPage` (`/teacher/class/:classId/student/:studentId`) — детальный профиль студента
- `TeacherAttendance` (`/teacher/lesson/:lessonId/attendance`) — bulk attendance
- `TeacherSubmissions` (`/teacher/homework/:homeworkId/submissions`) — оценка ДЗ
- `TeacherPendingHw` (`/teacher/homework`) — все непроверенные работы
- `TeacherProfilePage` (`/teachers/:id`) — публичный профиль (для студентов)
- `TeacherStats` (`/teacher/stats`) — 4 карточки + per-class grid

### Родитель (`PARENT`)

- `ParentHome` (`/parent`) — список детей + добавить ребёнка
- `ParentChild` (`/parent/child/:id`) — Overview/Attendance/Homework
- `ParentLinkPage` (`/parent/link`) — ввод кода для привязки

### Менеджер / Админ (`MANAGER` / `ADMIN` / `SUPER_ADMIN`)

- `AdminHome` (`/admin`) — дашборд + 13 quick-links + алерты
- `AdminUsers` (`/admin/users`) — pending users + смена роли
- `AdminStudents` (`/admin/students`) — поиск + CSV (ADMIN+)
- `AdminTeachers` (`/admin/teachers`) — CRUD + бейджи
- `AdminClasses` (`/admin/classes`) — CRUD + расписание
- `AdminEnrollments` (`/admin/enrollments`) — статусы зачислений
- `AdminTransfers` (`/admin/transfers`) — заявки на перевод
- `AdminTrials` (`/admin/trials`) — пробные уроки
- `AdminSupport` (`/admin/support`) — тикеты
- `AdminCertificates` (`/admin/certificates`) — выдача (по классу или поиск)
- `AdminBroadcast` (`/admin/broadcast`) — рассылка TG (ADMIN+)
- `AdminAudit` (`/admin/audit`) — журнал (ADMIN+)
- `AdminFinance` (`/admin/finance`) — финансы + CSV (ADMIN+)
- `AdminAnalytics` (`/admin/analytics`) — графики (ADMIN+)
- `AdminReferrals` (`/admin/referrals`) — реферальная аналитика
- `AdminPaymentSettings` (`/admin/payment-settings`) — провайдеры (ADMIN+)

---

## ✅ Этап 27 — Security & quality hardening (CRITICAL fixes)

**Статус:** завершён | прямые коммиты в `main`
**Дата:** 31.05.2026

### Цель

Закрыть все 4 CRITICAL проблемы из аудита `docs/AUDIT_ISSUES.md` (аудит от 30.05.2026).

### Что сделано

**C1 — N+1 в getClassStudentStats** | коммит `4566f48`
- Файл: `apps/api/src/modules/classes/classes.service.ts:159-205`
- Заменён `.map(async (e) => { 2×prisma.count() })` на 2 параллельных `groupBy()` + merge через `Map<student_id, count>`
- Запросов к БД: **2×N → 5** (константа, независимо от числа студентов)

**C2 — Слабая валидация presigned upload** | коммит `2207346`
- Файл: `apps/api/src/modules/storage/dto/presign.dto.ts`
- Добавлен `@Length(1, 255)` + `@Matches(/^[\w.\-]+$/)` на `filename`
- Добавлено обязательное поле `size: number` с `@IsNumber() @Min(1) @Max(52_428_800)` (лимит 50 MB)
- Frontend `apps/web/src/api/homework.ts`: передаёт `file.size` + исправлен `content_type` → `contentType`

**C3 — Hardcoded localhost fallback** | коммит `b0e6e6f`
- Файл: `apps/web/src/api/client.ts:34`
- `http://localhost:3000/api/v1` → `https://api-linguolab.muzaffarbahodir.uz/api/v1`
- Mixed-content errors в prod устранены

**C4 — Docker images используют :latest** | коммит `6a8adb6`
- Файл: `infra/compose/docker-compose.yml` + `.github/workflows/deploy-api.yml` + `deploy-admin.yml`
- docker-compose.yml: `${API_TAG:-latest}`, `${ADMIN_TAG:-latest}`, `${PORTAL_TAG:-latest}`
- deploy-api.yml: инжектирует `API_TAG=${{ github.sha }}` в `.env` перед `docker compose pull`
- deploy-admin.yml: инжектирует `ADMIN_TAG=${{ github.sha }}` в `.env`
- Rollback через: `API_TAG=<sha> docker compose up -d linguolab_api`

**H1 — Click webhook без DTO validation** | коммит `38a261f`
- Создан `ClickPrepareDto` + `ClickCompleteDto` с `@IsString`, `@IsNumberString`, `@Matches` на `sign_time`
- Controller → типизированные `@Body() ClickPrepareDto / ClickCompleteDto`
- Malformed request → 400 вместо краша / bypass подписи

**H2 — Future-dated auth_date** | коммит `3f99c38`
- Файл: `apps/api/src/modules/auth/telegram-init.validator.ts`
- Добавлена проверка `authDateSeconds > nowSeconds + 60 → 401`
- Forged token с auth_date в будущем теперь отклоняется

**H3 — SQL injection в analytics** | коммит `db13dc7`
- Файл: `apps/api/src/modules/admin/admin.service.ts`
- `analyticsRevenue()` + `analyticsStudents()`: добавлен guard `months < 1 || months > 36 → BadRequestException`
- `ParseIntPipe` в controller блокирует non-integer; range check блокирует DoS через огромный `months`

**H4 — Payme empty password** | коммит `29ffc06`
- Файл: `apps/api/src/modules/payments/payments.controller.ts`
- Условие: `!merchantKey || password !== merchantKey` → `!password || !merchantKey || password !== merchantKey`
- Явно блокирует пустую строку пароля

**H5 — O(n²) в Teacher Rating** | коммит `d1cfb62`
- Файл: `apps/api/src/modules/classes/classes.service.ts`
- Pre-build `Map<student_id, records[]>` за один проход → lookup O(1) вместо `.filter()` O(n) внутри `.map()`
- 100 студентов: 10,000 итераций → 100

### Коммиты

```
4566f48 fix(perf): C1 - resolve N+1 in getClassStudentStats
2207346 fix(security): C2 - strengthen presigned upload validation
b0e6e6f fix(security): C3 - replace localhost fallback with production API URL
6a8adb6 fix(infra): C4 - pin Docker images to SHA instead of :latest
3f99c38 fix(security): H2 - reject future-dated auth_date in Telegram initData
29ffc06 fix(security): H4 - reject empty password in Payme Basic auth
db13dc7 fix(security): H3 - validate months range in analytics raw queries
d1cfb62 fix(perf): H5 - eliminate O(n^2) in teacher rating computation
38a261f fix(security): H1 - add DTO validation to Click webhook endpoints
```

---

## 📌 Что осталось

### 🟡 Средний приоритет

- i18n остальных страниц: `TeacherHome`, `TeacherSubmissions`, `TeacherClass`, `ParentChild` (много хардкода), `Schedule`, `Courses`, `Home.TrialLessonsSection`, `AdminHome` (QUICK_LINKS labels), `AdminStudents`, `AdminFinance`
- Унификация error handling (сейчас разные подходы в разных страницах)
- Welcome-флоу 3-этапный для STUDENT (Этап 12.9 частично)

### 🟢 Низкий приоритет

- Этап 11.5 — Фискализация Soliq (отдельная задача)
- Этап 14 — Тесты (Unit / Integration / e2e Playwright)
- Этап 13.5 — analytics_events partitioned + materialized views
- Weekly PDF-отчёт SUPER_ADMIN'у
- Sentry + OpenTelemetry
