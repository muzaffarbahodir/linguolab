# HANDOFF — LinguoLab

> Полный контекст проекта. Читай первым делом. Не задавай уточняющих вопросов — здесь есть всё.

**Последнее обновление:** 30.05.2026 (Этапы 23-26 завершены — расширенная админка, TeacherStats, i18n 3 языка, статусные TG-уведомления, CSV экспорт, code splitting -35%)
**Источники правды:** этот файл + `PLAN_FINAL.md` + `project_progress.md` + `SESSION_SUMMARY.md` (все в `docs/`)

**Изменения после 12.9:**

- Этап 22 — TWA-only auth (PR #38, 15.05.2026)
- Этап 23 — 7 новых admin страниц (AdminTeachers/Classes/Analytics/Enrollments/Certificates/PaymentSettings/Referrals)
- Этап 24 — TeacherStats + полный i18n (ru/en/uz, ~700 строк JSON)
- Этап 25 — 6 статусных TG-уведомлений + CSV экспорт + глобальный поиск студентов
- Этап 26 — BottomSheet portal fix + code splitting (657kb→422kb)
- **Git workflow изменён:** работа напрямую на `main` (нет develop/feature branches), CI/CD автодеплоит Web и API параллельно

---

## 1. О проекте

**LinguoLab** — языковой центр в формате Telegram Web App (TWA). Студенты записываются на курсы английского/испанского/французского/китайского/узбекского, оплачивают занятия через узбекские платёжные системы, получают уведомления через Telegram, видят прогресс, родители контролируют детей, учителя ведут классы. Админ-панель для управления центром, аналитика для бизнеса.

**Платформа:** **Telegram Web App** (НЕ нативное приложение и НЕ React Native). Запускается из бота `@linguolab_bot` командой `/app` или кнопкой Menu. Открывается в WebView внутри Telegram. Причины:

- Нулевые барьеры установки (юзер уже в Telegram)
- Авторизация через `WebApp.initData` (HMAC, без пароля)
- Бот сразу = канал уведомлений (push не нужен)
- TG-группы как обсуждение классов
- Один codebase для всех платформ (iOS/Android/Desktop через Telegram WebView)

**Роли пользователей:**

| Роль          | Где работает                          | Что может                                                                                          |
| ------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `STUDENT`     | TWA                                   | Записываться на классы, видеть расписание, сдавать ДЗ, видеть прогресс, платить                    |
| `TEACHER`     | TWA (свой кабинет) + частично админка | Видеть свои классы, расписание, студентов, ставить оценки/ДЗ, отмечать посещаемость                |
| `MANAGER`     | Админка (ограниченная)                | Создавать классы/курсы, одобрять заявки, привязывать TG-группы, управлять расписанием              |
| `PARENT`      | TWA (parent-флоу)                     | Видеть детей (расписание, ДЗ, посещаемость, прогресс), получать уведомления о пропусках            |
| `ADMIN`       | Админка (полная)                      | CRUD всего, refund, ретрай фискализации, role management (кроме ADMIN/SUPER_ADMIN), audit log      |
| `SUPER_ADMIN` | Админка (root)                        | Всё + создание ADMIN'ов, настройка платёжных провайдеров, удаление audit log, финансовая аналитика |

Защита от привилегии-эскалации: ADMIN не может выдать ADMIN/SUPER_ADMIN; SUPER_ADMIN — единственный с `users.role.assign:SUPER_ADMIN`; смена роли инкрементит `users.token_version` → JWT инвалидируется → force relogin.

---

## 2. Полный стек технологий

### Frontend (TWA — `apps/web/`)

| Технология                    | Версия | Зачем                                                                                                 |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| React                         | 18.3.1 | UI                                                                                                    |
| Vite                          | 5.4    | Бандлер + dev-server (быстрее CRA, ESM нативный)                                                      |
| TypeScript                    | 5.9    | Типобезопасность                                                                                      |
| `@twa-dev/sdk`                | 8.0    | Обёртка над `window.Telegram.WebApp` — initData, MainButton, BackButton, HapticFeedback, CloudStorage |
| React Router                  | 6.27   | Клиентская навигация (SPA)                                                                            |
| TanStack Query                | 5.59   | Server state cache (staleTime 30s в TWA — пользователь часто переоткрывает)                           |
| Zustand                       | 5.0    | Локальный стейт **БЕЗ persist** (TWA WebView обнуляет; критичное — `WebApp.CloudStorage` 1024×4KB)    |
| Tailwind CSS                  | 3.4    | Атомарные классы + Telegram theme через CSS-vars (`bg-tg-bg`, `text-tg-text`, `bg-brand`)             |
| `prettier-plugin-tailwindcss` | 0.6    | Автосортировка классов                                                                                |
| ESLint 9 (flat config)        | 9.13   | Линтер                                                                                                |
| `typescript-eslint`           | 8.12   | TS-правила                                                                                            |

**i18n:** `i18next` + `react-i18next` установлены. Полная интернационализация реализована:

- `src/lib/i18n.ts` — синглтон, inline ресурсы (Vite JSON import, нет async), `lng` из `sessionStorage`
- `public/locales/{ru,uz,en}/translation.json` — все строки UI (12 namespace'ов: nav, home, schedule, courses, profile, booking, language_select, not_in_telegram, app, quick_actions, **homework**, **achievements**)
- `main.tsx` обёрнут в `<I18nextProvider i18n={i18n}>` — гарантирует re-render при `changeLanguage`
- `useLanguage.ts` → `applyLocale()` вызывает `i18n.changeLanguage(code)` + DOM-event
- Все страницы и компоненты используют `useTranslation()` + `t('key')`

### Backend (API — `apps/api/`)

| Технология                                    | Версия     | Зачем                                                            |
| --------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| NestJS                                        | 10.4       | Модульный фреймворк, DI, гварды, интерсепторы, декораторы        |
| Prisma                                        | 5.22       | Type-safe ORM + миграции. Engine `library` (стабильно на Alpine) |
| PostgreSQL                                    | 16-alpine  | Основная БД                                                      |
| Redis                                         | 7-alpine   | JWT refresh tokens (rotation chain), cache                       |
| BullMQ                                        | planned    | Очереди (Этап 11+: фискализация, уведомления, аналитика)         |
| grammY                                        | 1.42.0     | Telegram-бот (webhook-режим)                                     |
| `@aws-sdk/client-s3` + `s3-request-presigner` | ✅         | R2 presigned upload (Этап 10)                                    |
| `pdfkit`                                      | ✅         | Генерация PDF сертификатов (Этап 10)                             |
| `class-validator` + `class-transformer`       | 0.14 / 0.5 | DTO валидация (NestJS ValidationPipe)                            |
| `bcrypt`                                      | latest     | Admin password hash                                              |
| `@nestjs/jwt` + `passport-jwt`                | latest     | JWT access/refresh tokens                                        |
| Sentry + OpenTelemetry                        | planned    | Observability (Этап 14)                                          |

### Admin (`apps/admin/`)

| Технология | Версия            | Зачем                                                              |
| ---------- | ----------------- | ------------------------------------------------------------------ |
| Next.js    | 14.2 (App Router) | SSR + RSC + standalone output для Docker                           |
| NextAuth   | v4 (установлен)   | Credentials provider → `/auth/admin/login` API + JWT refresh chain |
| recharts   | Этап 13.5         | Графики дашбордов                                                  |
| Tailwind   | 3.4               | UI                                                                 |

### Инфраструктура

| Технология                           | Зачем                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| **pnpm 11.0.9** + **Turborepo 2.9**  | Монорепо + параллельные таски                                                   |
| Docker + Docker Compose v5           | Контейнеризация всего стека                                                     |
| **main_nginx** (existing)            | Общий reverse-proxy для всех проектов сервера                                   |
| **Cloudflare**                       | DNS, WAF, Universal SSL, R2 storage                                             |
| **Cloudflare R2**                    | S3-совместимое хранилище (бесплатный egress) для аватаров/ДЗ/сертификатов/чеков |
| GitHub Actions                       | CI/CD (lint/test + deploy)                                                      |
| GHCR (ghcr.io)                       | Docker registry (public packages)                                               |
| **Husky + commitlint + lint-staged** | Pre-commit + commit-msg хуки                                                    |

---

## 3. Инфраструктура (точные данные)

### Сервер

- **Провайдер:** Contabo VPS
- **IP:** `79.143.176.220`
- **OS:** Ubuntu 22.04.5 LTS
- **Ресурсы:** 6 vCPU AMD EPYC, 11.67 GiB RAM, 90 GiB диск свободно
- **SSH:** `root@79.143.176.220`, password + ed25519 ключ `~/.ssh/linguolab_deploy`
- **Docker:** 29.4.2 (CE) + Compose v5.1.3
- **Firewall:** `ufw inactive` (TODO позже включить)

### Домены

Зона `muzaffarbahodir.uz` управляется через **Cloudflare** (Free план).

| Hostname                             | Type | Content           | Proxy   | Назначение                 |
| ------------------------------------ | ---- | ----------------- | ------- | -------------------------- |
| `app-linguolab.muzaffarbahodir.uz`   | A    | `79.143.176.220`  | Proxied | TWA frontend (Vite static) |
| `api-linguolab.muzaffarbahodir.uz`   | A    | `79.143.176.220`  | Proxied | NestJS API                 |
| `admin-linguolab.muzaffarbahodir.uz` | A    | `79.143.176.220`  | Proxied | Next.js admin              |
| `cdn-linguolab.muzaffarbahodir.uz`   | R2   | `linguolab-files` | Proxied | Cloudflare R2 (WEUR)       |

⚠️ **dash-формат, НЕ `XXX.linguolab.muzaffarbahodir.uz`** — CF Free Universal SSL покрывает только `*.muzaffarbahodir.uz` (1 уровень wildcard), двухуровневый НЕ покрывается.

**Соседние домены на том же сервере (НЕ трогать):**

- `flowers.muzaffarbahodir.uz` — flowershop (Let's Encrypt cert)
- `tilloreferal.muzaffarbahodir.uz` — linkbetter bot

### Cloudflare

| Что                      | Где / Как                                                            |
| ------------------------ | -------------------------------------------------------------------- |
| SSL/TLS Mode             | **Full (strict)**                                                    |
| Universal SSL Cert       | Active, покрывает `*.muzaffarbahodir.uz` + apex (auto-renew)         |
| Origin Cert (на сервере) | Wildcard `*.muzaffarbahodir.uz`, 15 лет (до 07.05.2041), RSA 2048    |
| R2 Bucket                | `linguolab-files`, регион **WEUR**                                   |
| R2 Custom Domain         | `cdn-linguolab.muzaffarbahodir.uz`, Status Active                    |
| R2 CORS                  | `https://app-linguolab.muzaffarbahodir.uz`, методы GET/PUT/POST/HEAD |

### Docker сети

1. **`shared_web`** (external, существующая) — main_nginx + linguolab_api + linguolab_admin + соседи
2. **`linguolab_internal`** (наша) — linguolab_postgres + linguolab_redis + linguolab_api + linguolab_admin. **Порты наружу НЕ публикуются.**

### Контейнеры на сервере

| Контейнер            | Image                                                | Что                               |
| -------------------- | ---------------------------------------------------- | --------------------------------- |
| `linguolab_postgres` | `postgres:16-alpine`                                 | DB `linguolab`, owner `linguolab` |
| `linguolab_redis`    | `redis:7-alpine`                                     | requirepass, appendonly           |
| `linguolab_api`      | `ghcr.io/muzaffarbahodir/linguolab-api:latest`   | NestJS, port 3000                 |
| `linguolab_admin`    | `ghcr.io/muzaffarbahodir/linguolab-admin:latest` | Next.js standalone, port 3001     |

**Чужие — НЕ трогать:** `main_nginx`, `linkbetter_bot`, `flowershop_*`.

### Пути на сервере

```
/opt/linguolab/
├── nginx/conf.d/
│   ├── app.linguolab.conf       # TWA static
│   ├── api.linguolab.conf       # NestJS proxy
│   └── admin.linguolab.conf     # Next.js proxy
├── certs/
│   ├── origin.pem               # CF Origin Cert (644)
│   └── origin.key               # Private key (600)
├── web/dist/                    # Статика TWA (rsync из CI)
├── backups/                     # Postgres dumps (TODO cron)
└── compose/
    ├── docker-compose.yml       # 4 linguolab_* сервиса
    └── .env                     # ВСЕ секреты (600)
```

---

## 4. Структура репозитория

**URL:** https://github.com/muzaffarbahodir/linguolab (public)
**Ветки:** `main` (protected, PR-only) + `develop` (push разрешён)

**Conventional Commits обязательны** (enforced via commitlint, max body line 100 chars):
`feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`, `style`, `revert`

**PR:** squash-merge в `main`. После merge: GitHub Actions `sync-develop.yml` автоматически мержит `main → develop`.

⚠️ **sync-develop workflow** — после merge в main GHA pushes в develop. При следующем `git push origin develop` будет rejected. Решение:

```powershell
git pull origin develop --no-edit
git push origin develop
```

### Файловая структура (текущее состояние)

```
linguolab/
├── apps/
│   ├── web/                            # TWA (Vite + React)
│   │   └── src/
│   │       ├── main.tsx                # WebApp.ready/expand, auth init, QueryClient, BrowserRouter
│   │       ├── App.tsx                 # Auth-gated layout + Routes
│   │       ├── api/
│   │       │   ├── client.ts           # axios instance + 401→re-init interceptor
│   │       │   ├── token.ts            # tokenHolder singleton (разрывает circular dep)
│   │       │   ├── users.ts            # useMe, useMeProgress
│   │       │   ├── languages.ts        # useLanguages
│   │       │   ├── lessons.ts          # useUpcomingLessons
│   │       │   ├── enrollments.ts      # useMyEnrollments (MyEnrollment type с schedule полями)
│   │       │   ├── quick-actions.ts    # useRequestTrial, useMyTrials, useCreateTicket, useMyReferral
│   │       │   ├── homework.ts         # useMyHomework, useSubmitHomework (R2 presigned flow)
│   │       │   ├── achievements.ts     # useMyAchievements
│   │       │   └── payments.ts         # useCheckout, useMyPayments, useLastPending
│   │       ├── store/
│   │       │   └── auth.ts             # Zustand: login/logout/setNotInTelegram + status
│   │       ├── hooks/
│   │       │   ├── useUserRole.ts      # () => user?.role ?? null
│   │       │   └── useLanguage.ts      # _locale singleton + CloudStorage + custom DOM event
│   │       ├── components/
│   │       │   ├── BottomNav.tsx       # 4 пункта (Главная/Расписание/Занятия/Профиль)
│   │       │   ├── icons.tsx           # SVG-иконки 24×24
│   │       │   ├── BottomSheet.tsx     # Переиспользуемый bottom sheet (backdrop, scroll lock)
│   │       │   └── QuickActionsSheet.tsx # 3 экрана: trial/support/referral
│   │       └── pages/
│   │           ├── Home.tsx            # Приветствие, прогресс, языки, урок, кнопка ⚡
│   │           ├── Schedule.tsx        # Мои записи + расписание + ближайший урок
│   │           ├── Courses.tsx         # Каталог классов с фильтром по языку
│   │           ├── Profile.tsx         # Аватар TG, прогресс, меню, выбор языка
│   │           ├── Booking.tsx         # 3-шаговый stepper (язык→класс→подтверждение)
│   │           ├── LanguageSelect.tsx  # /language — выбор языка интерфейса
│   │           ├── NotInTelegram.tsx   # Запущено вне Telegram
│   │           ├── Homework.tsx        # /homework — список ДЗ + submit sheet (text/file)
│   │           ├── Achievements.tsx    # /achievements — unlocked/locked achievement cards
│   │           └── Payment.tsx         # /payment — выбор провайдера + checkout + история
│   │
│   ├── api/                            # NestJS API
│   │   ├── prisma/
│   │   │   ├── schema.prisma           # Все модели (см. секцию 6)
│   │   │   ├── migrations/             # 5 миграций
│   │   │   │   ├── 20260511000000_init_user_language/
│   │   │   │   ├── 20260512000000_add_teacher_class_enrollment/
│   │   │   │   ├── 20260512100000_add_telegram_chat_id_to_class/
│   │   │   │   ├── 20260512120000_add_schedule_to_class/
│   │   │   │   └── 20260512130000_add_quick_actions/
│   │   │   └── seed.ts                 # 5 языков + 2 учителя + 6 классов
│   │   └── src/
│   │       ├── main.ts                 # bootstrap, ValidationPipe, trust proxy, CORS
│   │       ├── app.module.ts           # регистрация всех модулей + APP_GUARDs
│   │       ├── prisma/{service,module}.ts    # @Global PrismaService
│   │       ├── redis/{service,module}.ts     # @Global RedisService extends Redis
│   │       ├── health/
│   │       │   └── health.controller.ts      # GET /health, GET / — @Public()
│   │       └── modules/
│   │           ├── auth/               # Telegram initData HMAC + JWT + Redis refresh
│   │           │   ├── auth.controller.ts
│   │           │   ├── auth.service.ts
│   │           │   ├── auth.module.ts
│   │           │   ├── telegram-init.validator.ts  # HMAC-SHA256 + timingSafeEqual + auth_date
│   │           │   ├── dto/{telegram-init,refresh,admin-login}.dto.ts
│   │           │   ├── strategies/jwt.strategy.ts  # validates tv === user.token_version
│   │           │   ├── guards/{jwt-auth,roles,admin,super-admin-only}.guard.ts
│   │           │   ├── decorators/{public,roles,current-user}.decorator.ts
│   │           │   └── __tests__/telegram-init.validator.spec.ts  # 12 unit тестов
│   │           ├── users/{service,controller,module}.ts       # GET /users/me, /users/me/progress
│   │           ├── languages/{service,controller,module}.ts   # GET /languages
│   │           ├── lessons/{service,controller,module}.ts     # GET /lessons/upcoming (UTC+5 calc)
│   │           ├── classes/{service,controller,module}.ts     # CRUD классов + enroll + schedule + group
│   │           ├── enrollments/{service,controller,module}.ts # GET my + GET all (admin) + PATCH status
│   │           ├── telegram/{service,controller,module}.ts    # grammY webhook + notifyEnrolled + sendGroupInvite
│   │           ├── trial-lessons/{service,controller,module}.ts  # POST request + GET my
│   │           ├── support/{service,controller,module}.ts        # POST tickets + GET my
│   │           ├── referrals/{service,controller,module}.ts      # GET my (upsert 6-char base36 code)
│   │           ├── storage/{service,controller,module}.ts        # POST presigned-upload → R2
│   │           ├── homework/{service,controller,module}.ts       # CRUD ДЗ + submit + grade
│   │           ├── achievements/{service,module}.ts              # @Global unlock triggers + GET my
│   │           ├── certificates/{service,controller,module}.ts  # PDF gen + R2 + Certificate record
│   │           ├── placement-tests/{controller,module}.ts       # start/answer/complete/my
│   │           ├── admin/{service,controller,module}.ts         # dashboard + CRUD students/teachers/classes/users
│   │           └── payments/
│   │               ├── payments.{service,controller,module}.ts  # checkout + history + admin + webhook routing
│   │               ├── payme/
│   │               │   ├── payme.types.ts                       # PaymeState/Error enums + helpers
│   │               │   └── payme.service.ts                     # JSON-RPC 2.0 handler (6 методов)
│   │               └── click/
│   │                   └── click.service.ts                     # prepare + complete + MD5 sign
│   │
│   └── admin/                          # Next.js 14 App Router
│       ├── app/
│       │   ├── layout.tsx              # <Providers> wrapper
│       │   ├── page.tsx                # Dashboard (4 карточки)
│       │   ├── login/page.tsx          # email+password форма
│       │   ├── enrollments/page.tsx    # список PENDING + одобрить/отклонить
│       │   ├── classes/
│       │   │   ├── page.tsx            # список классов + SetGroupForm + SetScheduleForm
│       │   │   └── set-schedule-form.tsx  # Client Component: дни/время/длительность
│       │   ├── providers.tsx           # SessionProvider
│       │   └── api/
│       │       ├── auth/[...nextauth]/route.ts  # NextAuth CredentialsProvider
│       │       └── proxy/
│       │           ├── enrollments/[id]/status/route.ts
│       │           ├── classes/[id]/group/route.ts
│       │           └── classes/[id]/schedule/route.ts
│       ├── lib/auth.ts                 # единый authOptions (getServerSession)
│       ├── middleware.ts               # NextAuth middleware
│       └── types/next-auth.d.ts        # расширение: accessToken, role в session
│
├── packages/                           # Зарезервировано (ui/types — позже)
│
├── infra/nginx/conf.d/                 # копии серверных vhost-конфигов
│
├── docs/                               # ВСЯ документация
│   ├── PLAN_FINAL.md                   # Итоговый план v5 (источник правды)
│   ├── HANDOFF.md                      # этот файл
│   ├── project_progress.md             # Дневник разработки (этапы 0.5 – 26)
│   ├── SESSION_SUMMARY.md              # Сводка последней большой сессии
│   ├── LAUNCH.md                       # Production runbook
│   └── PAYMENT_FISCALIZATION_PROMPT.md # Спека для Soliq (Этап 11.5)
│
├── .github/workflows/
│   ├── ci.yml                          # lint + format + typecheck + test
│   ├── deploy-web.yml                  # rsync apps/web/dist → VPS
│   ├── deploy-api.yml                  # docker build → GHCR → ssh compose pull/up
│   └── deploy-admin.yml                # то же
│
├── .env.example
├── commitlint.config.js                # type-enum + body-max-line-length 100
└── README.md                           # RU, TODO-чеклист этапов (GitHub main page)
```

---

## 5. ENV переменные

Файл на сервере: `/opt/linguolab/compose/.env` (chmod 600). Шаблон: `.env.example` в репо.

| Переменная                | Статус | Значение/Источник                                                    |
| ------------------------- | ------ | -------------------------------------------------------------------- |
| `NODE_ENV`                | ✅     | `production`                                                         |
| `DATABASE_URL`            | ✅     | `postgresql://linguolab:<PG_PASS>@linguolab_postgres:5432/linguolab` |
| `REDIS_URL`               | ✅     | `redis://:<REDIS_PASS>@linguolab_redis:6379`                         |
| `JWT_SECRET`              | ✅     | `openssl rand -hex 64`                                               |
| `JWT_REFRESH_SECRET`      | ✅     | `openssl rand -hex 64`                                               |
| `JWT_ACCESS_TTL`          | ✅     | `15m`                                                                |
| `JWT_REFRESH_TTL`         | ✅     | `30d`                                                                |
| `TELEGRAM_BOT_TOKEN`      | ✅     | токен от @BotFather (webhook зарегистрирован в Этапе 6)              |
| `TELEGRAM_BOT_USERNAME`   | ✅     | `linguolab_bot`                                                      |
| `TELEGRAM_WEBHOOK_SECRET` | ✅     | `openssl rand -hex 32`                                               |
| `TELEGRAM_WEB_APP_URL`    | ✅     | `https://app-linguolab.muzaffarbahodir.uz`                           |
| `APP_PUBLIC_URL`          | ✅     | `https://app-linguolab.muzaffarbahodir.uz`                           |
| `API_PUBLIC_URL`          | ✅     | `https://api-linguolab.muzaffarbahodir.uz`                           |
| `ADMIN_PUBLIC_URL`        | ✅     | `https://admin-linguolab.muzaffarbahodir.uz`                         |
| `CDN_PUBLIC_URL`          | ✅     | `https://cdn-linguolab.muzaffarbahodir.uz`                           |
| `NEXTAUTH_SECRET`         | ✅     | сгенерирован                                                         |
| `NEXTAUTH_URL`            | ✅     | `https://admin-linguolab.muzaffarbahodir.uz`                         |
| `R2_ACCOUNT_ID`           | ✅     | GitHub Secret → inject в .env при каждом деплое                      |
| `R2_ACCESS_KEY_ID`        | ✅     | GitHub Secret → inject в .env                                        |
| `R2_SECRET_ACCESS_KEY`    | ✅     | GitHub Secret → inject в .env                                        |
| `R2_BUCKET_NAME`          | ✅     | `linguolab-files`                                                    |
| `R2_PUBLIC_URL`           | ✅     | `https://cdn-linguolab.muzaffarbahodir.uz`                           |
| `R2_ENDPOINT`             | ✅     | GitHub Secret → inject в .env                                        |
| `PAYME_MERCHANT_ID`       | ⚠️     | sandbox (контракт не подписан)                                       |
| `PAYME_MERCHANT_KEY`      | ⚠️     | Basic Auth пароль для webhook (`Authorization: Basic base64(:key)`)  |
| `PAYME_CHECKOUT_URL`      | ✅     | `https://checkout.paycom.uz` (sandbox: `https://test.paycom.uz/`)    |
| `PAYME_USE_SANDBOX`       | ✅     | `true`                                                               |
| `CLICK_SERVICE_ID`        | ⚠️     | sandbox                                                              |
| `CLICK_MERCHANT_ID`       | ⚠️     | sandbox                                                              |
| `CLICK_SECRET_KEY`        | ⚠️     | HMAC-MD5 ключ подписи; если не задан — проверка пропускается (dev)   |
| `UZUMBANK_*`              | ⚠️     | заглушка (реальная интеграция — следующая итерация)                  |
| `SOLIQ_USE_SANDBOX`       | ✅     | `true`                                                               |
| `SOLIQ_TIN/...`           | ⚠️     | sandbox                                                              |
| `SOLIQ_VAT_RATE`          | ✅     | `12` (НДС Узбекистан)                                                |
| `LOG_LEVEL`               | ✅     | `info`                                                               |

**Никогда не коммитить `.env`. В чате секреты не вставлять.**

---

## 6. Схема БД (текущее состояние)

Prisma schema: `apps/api/prisma/schema.prisma`. Все миграции применены на сервере.

### Текущие Enums

```prisma
enum Role                    { STUDENT TEACHER MANAGER PARENT ADMIN SUPER_ADMIN }
enum CEFR                    { A1 A2 B1 B2 C1 C2 }
enum EnrollmentStatus        { PENDING ACTIVE DROPPED }
enum TrialStatus             { PENDING CONFIRMED CANCELLED }
enum TicketStatus            { OPEN IN_PROGRESS CLOSED }
enum HomeworkSubmissionStatus { SUBMITTED GRADED LATE }
enum AchievementTrigger      { FIRST_ENROLLMENT FIRST_HOMEWORK HOMEWORK_STREAK_5
                               HOMEWORK_STREAK_10 PERFECT_GRADE TRIAL_COMPLETED REFERRAL_1 }
enum LessonStatus            { SCHEDULED COMPLETED CANCELLED }
enum AttendanceStatus        { PRESENT ABSENT LATE }
enum PaymentProvider         { PAYME CLICK UZUMBANK }
enum PaymentStatus           { PENDING AUTHORIZED PAID CANCELLED REFUNDED FAILED EXPIRED }
enum FiscalStatus            { PENDING SENT FAILED }
enum ReceiptType             { SALE REFUND }
```

### Текущие таблицы

**`User`** — все поля включая `token_version`, `tg_blocked`, `last_active_at`. Relations: `Teacher?`, `enrollments[]`, `trial_requests[]`, `support_tickets[]`, `referral?`, `homework_submissions[]`, `achievements[]`, `certificates[]`.

**`Language`** — `id`, `code` (ISO 639-1), `name_ru`, `flag_emoji`, `color?`, `is_active`. Сид: en/es/fr/zh/uz.

**`Teacher`** — `id`, `user_id` (1:1 с User), `bio?`, `photo_url?`. Relations: `languages[]`, `classes[]`.

**`Class`** — `id`, `title`, `description?`, `language_id`, `teacher_id`, `level` (CEFR), `price_uzs`, `max_students`, `telegram_chat_id BigInt?` (TG-группа), `schedule_days String[]`, `schedule_time String?`, `schedule_duration Int?`, `is_active`. Relations: `enrollments[]`, `homeworks[]`, `certificates[]`.

**`Enrollment`** — `id`, `student_id`, `class_id`, `status` (EnrollmentStatus), `created_at`. Unique: `(student_id, class_id)`.

**`TrialLessonRequest`** — `id`, `student_id`, `language_id`, `note?`, `status` (TrialStatus). Не может быть дубль PENDING на один язык.

**`SupportTicket`** — `id`, `student_id`, `subject` (3–120 chars), `message` (10–2000 chars), `status` (TicketStatus).

**`Referral`** — `id`, `referrer_id` (1:1 с User), `code` (unique, 6-char base36 UPPERCASE), `used_count Int default 0`.

**`Homework`** — `id`, `class_id`, `title`, `description?`, `due_date DateTime?`, `created_at`. Relations: `class`, `submissions[]`.

**`HomeworkSubmission`** — `id`, `homework_id`, `student_id`, `file_key?`, `file_url?`, `text_answer?`, `grade Int?` (0–100), `feedback?`, `status` (HomeworkSubmissionStatus), `submitted_at`, `graded_at?`. Unique: `(homework_id, student_id)`.

**`Achievement`** — `id`, `trigger` (AchievementTrigger, unique), `title_ru/uz/en`, `description_ru/uz/en`, `icon` (emoji). Сид: 7 записей.

**`UserAchievement`** — `id`, `user_id`, `achievement_id`, `unlocked_at`. Unique: `(user_id, achievement_id)`.

**`Certificate`** — `id`, `student_id`, `class_id`, `pdf_url`, `issued_at`. Уникален на `(student_id, class_id)`.

**`Lesson`** — `id`, `class_id`, `teacher_id`, `title?`, `scheduled_at`, `duration_minutes`,
`status (LessonStatus)`, `notes?`. Relations: `class`, `teacher`, `attendances[]`.

**`LessonAttendance`** — `id`, `lesson_id`, `student_id`, `status (AttendanceStatus)`, `note?`.
Unique: `(lesson_id, student_id)`.

**`Payment`** — `id (cuid)`, `user_id`, `class_id`, `amount_tiyin (BigInt)`,
`vat_amount_tiyin (BigInt)`, `provider (PaymentProvider)`, `status (PaymentStatus)`,
`idempotency_key (UNIQUE)`, `provider_txn_id?`, `provider_state (Int)?`, `paid_at?`,
`payload_in (Json)?`, `payload_out (Json)?`, `created_at`, `updated_at`.
Named relations: `PaymentUser` (user→payments), `PaymentPayer` (user→payments_as_payer).

**`FiscalReceipt`** — связан с Payment, хранит OFD-данные: `receipt_id?`, `fiscal_sign?`,
`status (FiscalStatus)`, `sent_at?`, `type (ReceiptType)`.

**`WebhookEvent`** — `id`, `provider`, `external_id`, `payment_id?`, `raw_body (Json)`,
`processed (Bool)`, `processed_at?`. `@@unique([provider, external_id])` — идемпотентность.

**`PaymentProviderConfig`** — `id`, `provider`, `enabled (Bool)`, `config (Json)?`.
Сид: Payme enabled=true, Click enabled=false, Uzumbank enabled=false.

⚠️ **Отличия от PLAN_FINAL:**

- `Referral` — нет полей `invitee_id`, `redeemed_at`, `bonus_days_granted` (упрощённая версия)
- `SupportTicket.message` — в плане было `body`
- `HomeworkSubmission.teacher_note` → `feedback` (переименовано)
- `Payment.user_id` хранит и студента и плательщика через named relations

### Планируемые таблицы (Этапы 12–13)

`parent_child_links`, `parent_link_invites`, `analytics_events` (партицированная),
`audit_log`, `feature_flags`, materialized views.

---

## 7. API Endpoints

Все под `/api/v1` (кроме `GET /health` и `GET /`).

### Реализованные (Этапы 0–9)

| Метод   | Путь                      | Описание                                   | Guard / Роли            |
| ------- | ------------------------- | ------------------------------------------ | ----------------------- |
| `GET`   | `/health`                 | Healthcheck                                | @Public                 |
| `GET`   | `/`                       | Service info                               | @Public                 |
| `POST`  | `/auth/telegram/init`     | HMAC verify + JWT issuance + upsert user   | @Public                 |
| `POST`  | `/auth/refresh`           | Refresh token → new pair                   | @Public                 |
| `POST`  | `/auth/admin/login`       | email+password (MANAGER+)                  | @Public                 |
| `POST`  | `/auth/logout`            | Revoke refresh                             | JWT                     |
| `GET`   | `/users/me`               | Профиль текущего пользователя              | JWT                     |
| `GET`   | `/users/me/progress`      | Прогресс                                   | JWT                     |
| `GET`   | `/languages`              | Справочник языков                          | @Public                 |
| `GET`   | `/lessons/upcoming`       | Ближайший урок (UTC+5, реальный расчёт)    | JWT                     |
| `GET`   | `/classes`                | Список классов (фильтр: languageId, level) | JWT                     |
| `GET`   | `/classes/:id`            | Детали класса                              | JWT                     |
| `POST`  | `/classes/:id/enroll`     | Записаться (409 дубль, 400 нет мест)       | JWT                     |
| `PATCH` | `/classes/:id/group`      | Привязать TG-группу (chat_id)              | JWT + MANAGER+          |
| `PATCH` | `/classes/:id/schedule`   | Установить расписание                      | JWT + MANAGER+          |
| `GET`   | `/enrollments/my`         | Мои записи (ACTIVE/PENDING)                | JWT                     |
| `GET`   | `/enrollments`            | Все записи (для менеджера)                 | JWT + MANAGER+          |
| `PATCH` | `/enrollments/:id/status` | Одобрить (ACTIVE) / Отклонить (DROPPED)    | JWT + MANAGER+          |
| `POST`  | `/telegram/webhook`       | grammY обработчик                          | @Public + secret header |
| `POST`  | `/trial-lessons/request`  | Заявка на пробный урок                     | JWT                     |
| `GET`   | `/trial-lessons/my`       | Мои заявки на пробный                      | JWT                     |
| `POST`  | `/support/tickets`        | Создать тикет поддержки                    | JWT                     |
| `GET`   | `/support/tickets/my`     | Мои тикеты                                 | JWT                     |
| `GET`   | `/referrals/my`           | Мой реферальный код (upsert)               | JWT                     |

### Реализованные (Этап 10)

| Метод   | Путь                              | Описание                                                   | Guard / Роли   |
| ------- | --------------------------------- | ---------------------------------------------------------- | -------------- |
| `POST`  | `/storage/presigned-upload`       | R2 presigned PUT URL (TTL 15m) → {key,uploadUrl,publicUrl} | JWT            |
| `POST`  | `/homework`                       | Создать ДЗ для класса                                      | JWT + TEACHER+ |
| `GET`   | `/homework/class/:classId`        | Список ДЗ класса                                           | JWT            |
| `GET`   | `/homework/my`                    | Мои ДЗ (все классы студента) с my_submission               | JWT            |
| `POST`  | `/homework/:id/submit`            | Сдать ДЗ (text_answer и/или file_key+file_url)             | JWT            |
| `PATCH` | `/homework/submissions/:id/grade` | Выставить оценку + feedback                                | JWT + TEACHER+ |
| `GET`   | `/homework/:id/submissions`       | Сданные работы по ДЗ                                       | JWT + TEACHER+ |
| `GET`   | `/achievements/my`                | {unlocked: [...], locked: [...]}                           | JWT            |
| `POST`  | `/certificates/issue`             | Выдать сертификат (PDF → R2)                               | JWT + MANAGER+ |
| `GET`   | `/certificates/my`                | Мои сертификаты                                            | JWT            |

### Реализованные (Этап 11 + gap-fixes)

| Метод    | Путь                              | Описание                                              | Guard / Роли         |
| -------- | --------------------------------- | ----------------------------------------------------- | -------------------- |
| `PATCH`  | `/users/me`                       | Обновить профиль (name, locale, timezone, avatar_url) | JWT                  |
| `GET`    | `/users/me/progress`              | Прогресс: enrollments, homework stats, achievements   | JWT                  |
| `PATCH`  | `/users/me/notification-channels` | Настройки уведомлений (stub, Этап 12)                 | JWT                  |
| `GET`    | `/lessons/history`                | История завершённых уроков студента                   | JWT                  |
| `GET`    | `/lessons/:id`                    | Деталь урока с посещаемостью                          | JWT                  |
| `POST`   | `/lessons`                        | Создать урок                                          | JWT + TEACHER+       |
| `GET`    | `/lessons/class/:classId`         | Уроки класса                                          | JWT                  |
| `POST`   | `/lessons/:id/attendance/bulk`    | Массовая отметка посещаемости                         | JWT + TEACHER+       |
| `GET`    | `/lessons/:id/attendance`         | Посещаемость урока                                    | JWT + TEACHER+       |
| `POST`   | `/placement-tests/start`          | Начать тест размещения                                | JWT                  |
| `POST`   | `/placement-tests/:id/answer`     | Ответить на вопрос                                    | JWT                  |
| `POST`   | `/placement-tests/:id/complete`   | Завершить тест                                        | JWT                  |
| `GET`    | `/placement-tests/my`             | Мои тесты размещения                                  | JWT                  |
| `GET`    | `/admin/dashboard/widgets`        | 7 счётчиков (students/enrollments/teachers/etc)       | JWT + MANAGER+       |
| `GET`    | `/admin/students`                 | Список студентов (поиск, пагинация)                   | JWT + MANAGER+       |
| `GET`    | `/admin/students/:id`             | Студент с enrollments                                 | JWT + MANAGER+       |
| `PATCH`  | `/admin/students/:id`             | Обновить студента                                     | JWT + MANAGER+       |
| `DELETE` | `/admin/students/:id`             | Удалить студента                                      | JWT + ADMIN+         |
| `GET`    | `/admin/teachers`                 | Список учителей                                       | JWT + MANAGER+       |
| `POST`   | `/admin/teachers`                 | Создать учителя (User+Teacher profile)                | JWT + MANAGER+       |
| `PATCH`  | `/admin/teachers/:id`             | Обновить учителя                                      | JWT + MANAGER+       |
| `DELETE` | `/admin/teachers/:id`             | Удалить учителя (блок если есть активные классы)      | JWT + ADMIN+         |
| `GET`    | `/admin/classes`                  | Список классов (admin view)                           | JWT + MANAGER+       |
| `POST`   | `/admin/classes`                  | Создать класс                                         | JWT + MANAGER+       |
| `PATCH`  | `/admin/classes/:id`              | Обновить класс                                        | JWT + MANAGER+       |
| `DELETE` | `/admin/classes/:id`              | Удалить класс                                         | JWT + ADMIN+         |
| `GET`    | `/admin/users`                    | Список пользователей (фильтр по роли)                 | JWT + ADMIN+         |
| `PATCH`  | `/admin/users/:id/role`           | Сменить роль (с защитой от эскалации)                 | JWT + ADMIN+         |
| `POST`   | `/payments/checkout`              | Создать платёж (идемпотентно), redirect URL           | JWT                  |
| `POST`   | `/payments/payme`                 | Payme JSON-RPC webhook                                | @Public + Basic Auth |
| `POST`   | `/payments/click/prepare`         | Click prepare webhook                                 | @Public + MD5 sign   |
| `POST`   | `/payments/click/complete`        | Click complete webhook                                | @Public + MD5 sign   |
| `GET`    | `/payments/history`               | История платежей студента (50 записей)                | JWT                  |
| `GET`    | `/payments/last-pending`          | Последний незавершённый платёж                        | JWT                  |
| `GET`    | `/payments/:id`                   | Деталь платежа                                        | JWT                  |
| `GET`    | `/admin/payments`                 | Все платежи (пагинация, фильтр по статусу)            | JWT + MANAGER+       |
| `POST`   | `/admin/payments/:id/refund`      | Возврат (PAID→REFUNDED)                               | JWT + ADMIN+         |

### Планируемые (Этапы 11.5+)

Fiscal receipts (Soliq OFD), BullMQ notifications, parents module, analytics — см. `PLAN_FINAL.md` (рядом).

---

## 8. Что уже сделано (точно)

### ✅ Этап 0.5 — Инфраструктура

Cloudflare + Origin Cert + R2 + сервер + nginx + postgres + redis + GitHub repo + CI + branch protection. Детали — `project_progress.md`.

### ✅ Этап 1 — Скелет приложений (11.05.2026)

`apps/web/` Vite+React+Tailwind+twa-dev+Router+BottomNav. `apps/api/` NestJS+Prisma+seed(5 языков). `apps/admin/` Next.js skeleton. 4 GHA workflows (ci + 3×deploy). SSH ed25519 deploy key. Миграция на dash-format хосты. Все 4 публичных URL HTTP/2 200.

### ✅ Этап 2 — Auth через Telegram initData (12.05.2026)

**API:** `TelegramInitDataValidator` (HMAC-SHA256, timingSafeEqual, auth_date ≤24ч). JWT access (15m) + refresh (30d, Redis rotation chain с familyId + reuse detection). `JwtAuthGuard` глобальный APP_GUARD + `@Public()` opt-out. `RolesGuard` как второй APP_GUARD. Декораторы `@CurrentUser()`, `@Roles()`. Admin email+password через bcrypt. 12 unit-тестов.

**Web:** `tokenHolder.ts` singleton (разрывает circular dep). axios instance + 401→re-init interceptor. Zustand auth store. Auth-gated App.tsx (loading/not_in_telegram/error/authenticated states).

**Admin:** NextAuth v4 CredentialsProvider + JWT callback с refresh. `lib/auth.ts` единый authOptions. middleware защита роутов.

### ✅ Этап 3 — Home + Profile (12.05.2026)

API: `GET /users/me`, `/users/me/progress`, `/languages`, `/lessons/upcoming` (мок). Web: HomeScreen (приветствие по времени суток, прогресс 65%, карточки языков, ближайший урок, CTA). ProfileScreen (аватар из TG photo_url / инициалы, прогресс 70%, 6 пунктов меню).

### ✅ Этап 4 — Каталог + классы (12.05.2026)

Prisma: `Teacher`, `Class`, `Enrollment` + `EnrollmentStatus`. Seed: 2 учителя + 6 классов. API: `GET /classes` (фильтр, enrolled_count, spots_left), `GET /classes/:id`, `POST /classes/:id/enroll` (409/400). Web: Courses.tsx карточки с фильтром по языку.

### ✅ Этап 5 — Флоу записи 3 шага (12.05.2026)

BookingPage 3-step stepper (язык→класс→подтверждение). Telegram `BackButton` между шагами. BottomNav скрыт на `/book`. Schedule.tsx: `GET /enrollments/my` + карточки с цветными статусами. `sync-develop.yml` добавлен (авто-sync main→develop).

### ✅ Этап 6 — Telegram-бот grammY (12.05.2026)

`TelegramModule` @Global. Bot webhook-режим: `/start` + InlineKeyboard открыть TWA. `notifyEnrolled()` fire-and-forget при успешной записи. `POST /telegram/webhook` + secret header + @Public(). Webhook зарегистрирован: `{"ok":true,"result":true}`.

### ✅ Этап 7 — Telegram-группы для классов (12.05.2026)

`Class.telegram_chat_id BigInt?`. `sendGroupInvite()` — одноразовый invite link при одобрении заявки. `PATCH /enrollments/:id/status` (MANAGER+). Admin-панель `/enrollments` + `/classes` с привязкой группы. Admin login работает через psql: `admin@linguolab.uz` / `AdminPass123!`.

### ✅ Этап 8 — Расписание (12.05.2026)

`schedule_days String[]`, `schedule_time String?`, `schedule_duration Int?` в `Class`. `PATCH /classes/:id/schedule`. `GET /lessons/upcoming` — реальный алгоритм UTC+5, перебирает 8 дней вперёд. Schedule.tsx: расписание + ближайшее занятие. Admin: `SetScheduleForm`.

**CI fix:** TS2339 `schedule_days/time/duration` не в `MyEnrollment.class` → добавлены 3 поля в тип.

### ✅ Этап 9 — Quick actions (12.05.2026)

Prisma: `TrialLessonRequest`, `SupportTicket`, `Referral` + enums. API: trial-lessons, support, referrals модули. Web: `BottomSheet` (scroll lock, backdrop), `QuickActionsSheet` (3 экрана: trial/support/referral), кнопка ⚡ на Home.

### ✅ Фича: Выбор языка интерфейса (12.05.2026, вне плана)

`hooks/useLanguage.ts` — module-level `_locale`, CloudStorage persistence, sessionStorage sync cache, кастомный DOM-event. `pages/LanguageSelect.tsx` — `/language` роут. Profile меню: пункт «🌐 Язык» с hint текущего языка + haptic feedback.

---

### ✅ Этап 10 — Storage/R2 + Homework + Achievements + Certificates (13.05.2026)

PRs #23 (backend) + #24 (TWA frontend). Детали — `project_progress.md`.

StorageModule (R2 presigned upload). HomeworkModule (create/list/submit/grade). AchievementsModule
(@Global, auto-unlock triggers, `GET /achievements/my`). CertificatesModule (pdfkit PDF → R2 →
Certificate record). Prisma: 5 новых моделей, 2 enum, seed 7 достижений. GH Actions: inject R2
secrets + `prisma migrate deploy`. TWA: `pages/Homework.tsx` (list + submit sheet с file upload),
`pages/Achievements.tsx` (unlocked/locked cards), `api/homework.ts`, `api/achievements.ts`,
i18n homework._/achievements._, роуты /homework и /achievements.

---

### ✅ Этап 11 — Платежи UZ: Payme + Click + Uzumbank (13.05.2026)

Коммиты в develop: `48a282a`, `34c2690`, `85a292f`. Детали — `project_progress.md`.

**Gap-fixes (9+7 пропущенных пунктов):** PlacementTestsModule (start/answer/complete/my),
LessonsModule расширен (history, createLesson, bulkAttendance), AdminModule полный
(dashboard/students/teachers/classes/users+role), common/money.ts (uzsToTiyin, calcVatTiyin),
Prisma Lesson+LessonAttendance, PATCH /users/me, GET /users/me/progress, notification-channels stub.

**Payments core:** PaymentsService (checkout идемпотентный, buildProviderUrl для Payme/Click/Uzumbank,
history, admin list/refund). PaymeService (полный JSON-RPC 2.0: Check/Create/Perform/Cancel/Check/
GetStatement, 12ч таймаут, fire-and-forget handlePaymentPaid). ClickService (prepare+complete,
MD5 verifySign). PaymentsController (@Public webhooks, Basic Auth verify для Payme). Prisma:
Payment (BigInt tiyin, idempotency_key UNIQUE), FiscalReceipt, WebhookEvent (@@unique provider+id),
PaymentProviderConfig. TWA: Payment.tsx (провайдер-селектор, checkout mutation, WebApp.openLink,
история). api/payments.ts (useCheckout, useMyPayments, useLastPending). i18n payment.\* ключи.

### ✅ Этап 11.5 — Фискализация Soliq OFD (13.05.2026)

Коммит `3d8405b`. FiscalModule: SoliqAuthService (Bearer cache), SoliqClient (sandbox stub / real),
FiscalReceiptBuilder (ИКПУ 10401010001000000, units=1221006, VAT 12%), FiscalSendProcessor
(BullMQ 6 попыток backoff 1м/5м/30м/2ч/12ч/24ч), FiscalService (enqueue, retry, getReceipt),
FiscalController (GET receipt/:id, by-payment/:pid, POST retry ADMIN+).
PaymentsModule импортирует FiscalModule. fire-and-forget после PAID → scheduleReceipt,
после REFUNDED → scheduleRefundReceipt. Sandbox без credentials → stub ответ.

### ✅ Этап 12 — BullMQ Telegram-уведомления (14.05.2026)

Коммит `2797f24`. NotificationsModule: NotificationType enum (8 типов), DEDUP_TTL map,
NotificationSendProcessor (BullMQ 3 попытки exp backoff 5s, Redis SETEX dedup),
NotificationsService (schedulePaymentConfirmed/Refunded, scheduleLessonReminder с delayed job,
scheduleHomeworkNew, notifyParentsOf\* через getParentsOf).
Интеграция: LessonsModule, HomeworkModule, PaymentsModule — все импортируют NotificationsModule.

### ✅ Этап 12.5 — Модуль «Родители» (14.05.2026)

Коммит `c3b9263`. Prisma: ParentChildLink + ParentLinkInvite (миграция 20260513060000_add_parents).
ParentsService: createInvite (24ч, max 10 детей, старые инвалидируются), acceptInvite ($transaction,
max 5 родителей, 409 на дубль), assertAccess (ForbiddenException guard), read-only endpoints
для расписания/ДЗ/посещаемости/прогресса ребёнка.
ParentsController: 8 эндпоинтов с @Roles(PARENT) / @Roles(STUDENT).

### ✅ Этап 12.7 — Личный кабинет учителя в TWA (14.05.2026)

Коммит `86f5372`. Backend: GET /classes/my (role-based), GET /classes/:classId/students (ACTIVE).
Frontend: api/teacher.ts (10 hooks), pages/teacher/TeacherHome.tsx (class cards),
TeacherClass.tsx (3 tabs: Уроки/Студенты/ДЗ + modals), TeacherAttendance.tsx (bulk attendance),
TeacherSubmissions.tsx (grade modal). App.tsx: teacher routes + role fallback.
BottomNav.tsx: role-based nav (teacher vs student items).

### ✅ Этап 12.9 — Onboarding + Retention (14.05.2026)

Коммит `b593a1f`. NotificationType +WELCOME +RETENTION_REMINDER +HOMEWORK_OVERDUE.
RetentionProcessor: @Processor(retention), daily cron jobs via BullMQ repeatable
(inactive_students 10:00 UTC, homework_overdue 07:00 UTC), limit 100/20.
AuthService: void notifications.scheduleWelcome() — dedup TTL 1 год, один welcome per lifetime.
TWA: Onboarding.tsx (3 slides, CloudStorage tracking), PlacementTest.tsx (language→questions→result),
api/placement-tests.ts (4 hooks), App.tsx (onboarding overlay + /placement-test route),
Profile.tsx (Тест уровня).

---

## 9. Текущий этап — Этап 13.5 — Аналитика

### ✅ Этап 13 завершён (14.05.2026, коммит 8bbc531)

**Сделано:**

- `AuditLog` модель + миграция + `AuditService` (log/list)
- Audit logging во всех admin write-операциях (delete/create/role_change)
- `POST /admin/notifications/broadcast` — массовая TG рассылка (BullMQ, лимит 500)
- `GET /admin/students/export` + `GET /admin/payments/export` — CSV с BOM
- `GET /admin/audit` — журнал аудита (ADMIN+)
- `GET/PATCH /admin/settings/payment-providers/:provider` — Settings
- Admin UI: `/audit`, `/broadcast`, `/export`, `/settings` + обновлён дашборд

### Что делать (Этап 13.5)

- **Дашборд аналитика** — `GET /admin/analytics` (revenue по месяцам, активность студентов)
- **Графики в Next.js** — recharts или chart.js: выручка, новые студенты, активность
- **Воронка записей** — кол-во PENDING → ACTIVE → DROPPED по неделям
- **Отчёт учителя** — посещаемость + успеваемость по классу

**Ключевые файлы:**

```
apps/api/src/modules/admin/admin.service.ts   — analyticsRevenue(), analyticsStudents()
apps/api/src/modules/admin/admin.controller.ts — GET /admin/analytics/revenue
apps/admin/app/analytics/page.tsx             — графики
```

**Новые ENV:** нет.

---

## 10. Предпочтения по работе

| Что                       | Правило                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Коммиты**               | Conventional Commits обязательны. Max body line 100 chars (commitlint правило).                                                   |
| **Ветки**                 | `main` (protected) + `develop`. Фичи в `develop` → PR в `main`.                                                                   |
| **PR**                    | Squash merge в `main`. После merge: `git pull origin develop --no-edit && git push origin develop` (из-за sync-develop workflow). |
| **CI**                    | Lint + format + typecheck + test на каждый push. Зелёный CI обязателен для merge.                                                 |
| **Стиль кода**            | Подробные комментарии для обучения — особенно HMAC, RBAC, фискализация, retention-cron. JSDoc на public API.                      |
| **Язык комментариев**     | Русский.                                                                                                                          |
| **`project_progress.md`** | **ПОСЛЕ КАЖДОГО ЭТАПА** — детальная запись. Коммит: `docs: update project_progress.md`.                                           |
| **`README.md`**           | TODO-чеклист — обновлять при закрытии этапов.                                                                                     |
| **HANDOFF.md**            | Обновлять при значительном изменении состояния проекта (смена текущего этапа, новые архитектурные решения).                       |
| **Деплой**                | Push в `main` → автодеплой через Actions. Staging НЕТ.                                                                            |
| **Сервер-команды**        | Пошагово, юзер копипастит, вывод присылает обратно.                                                                               |

---

## 11. Важные архитектурные решения

### Почему не второй nginx

Bind-mount конфигов в существующий main_nginx. Без конфликтов по портам 80/443, без даунтайма соседей.

### Почему Cloudflare Origin Cert, не Let's Encrypt

15 лет vs 90 дней. Не нужен certbot. Валиден только через CF orange cloud — это наш режим.

### Почему отдельные linguolab_postgres/redis

Изоляция от flowershop. Разные Prisma/SQLAlchemy схемы. Независимые пароли и падения.

### Почему TWA

Нулевые установки. Автоавторизация через initData. Bot = канал уведомлений. Один codebase iOS+Android+Desktop.

### Почему R2, а не S3/MinIO

Нулевой egress. S3-совместимый API. Глобальная CDN. 10 GB бесплатно. Нет отдельного сервиса.

### Глобальный APP_GUARD + @Public()

Все роуты защищены по умолчанию. Opt-out через `@Public()`. Меньше шанс забыть.

### tokenHolder singleton

Разрывает circular dependency `client.ts ↔ store/auth.ts` без `require()`.

### Refresh токены в Redis (не в БД)

TTL встроен в Redis. Быстрее. Rotation chain с familyId + reuse detection (SCAN вместо KEYS).

### schedule days/time на Class, не на отдельной таблице

Языковой центр — фиксированное расписание на весь период. Гибкий per-lesson calendar — в Этапе 12+.

### Кастомный i18n без i18next

CloudStorage асинхронен; sessionStorage — sync cache. Module-level singleton + custom DOM event = реактивность без библиотеки. i18next можно добавить позже если нужны переводы строк.

---

## 12. Риски и известные проблемы

### Решённые

1. `pnpm 11 ERR_PNPM_IGNORED_BUILDS` — `onlyBuiltDependencies` в workspace + package.json.
2. Husky в Docker prod — `HUSKY=0` ENV + `"prepare": "husky || true"`.
3. `nest build` собирал только main.ts — `tsc -p tsconfig.build.json` напрямую.
4. Next.js standalone на Windows — `output: process.platform === 'win32' ? undefined : 'standalone'`.
5. Prisma client в runtime stage — `pnpm deploy --prod` + cp `.prisma @prisma`.
6. CF Universal SSL 2-уровневый wildcard — dash-format хосты.
7. GHCR private — сделали public через GH UI.
8. `localhost = ::1` в Alpine healthcheck — заменили на `127.0.0.1`.
9. Next.js standalone не слушает loopback — `HOSTNAME=0.0.0.0`.
10. `getServerSession()` без authOptions → null — вынести в `lib/auth.ts`.
11. Circular dep `client ↔ store/auth` в Vite ESM — `tokenHolder.ts` singleton.
12. BigInt(id) в TG user_id — может превышать `Number.MAX_SAFE_INTEGER`.
13. sync-develop GHA pushes в develop после merge → `git push` rejected — `git pull --no-edit` сначала.
14. commitlint body-max-line-length 100 — укорачивать строки в теле коммита.
15. TS2339 `schedule_days/time/duration` не в `MyEnrollment.class` — добавить поля в тип.
16. Прокси-роут конфликт в admin (PATCH `[id]` перекрывал sub-routes) — разделить на `/group/route.ts` и `/schedule/route.ts`.

### Открытые

- **Referral схема** отличается от PLAN_FINAL (нет invitee_id, redeemed_at, bonus_days_granted).
- **Firewall (ufw)** — inactive. Включить в Этапе 14 (CI/CD финал).
- **Бэкапы Postgres** → R2 — cron не настроен.
- **Certificates TWA-страница** — бэкенд готов, TWA-страницы нет.
- **Прогресс 70%** в Profile.tsx захардкожен — реальный расчёт планируется позже.
- **Uzumbank** — только stub URL; реальная интеграция не начата.
- **adminRefund** — меняет статус в БД, реальный refund API провайдера — TODO позже.
- **Soliq реальные credentials** — sandbox stub работает; prod требует SOLIQ_CLIENT_ID + SOLIQ_CLIENT_SECRET + SOLIQ_TERMINAL_ID от Soliq OFD кабинета.
- **PlacementTest scoring** — API-стабы существуют, реальная логика подсчёта баллов — TODO Этап 12.9.
- **PlacementTest** — контроллер создан, но `PlacementTestService` содержит только заглушки
  (нет реальной логики вопросов/скоринга). Нужна схема вопросов.
- **Payme/Click sandbox** — интеграция написана, но не протестирована на реальном webhook
  (sandbox credentials не настроены).

---

## 13. Команды которые часто нужны

### Зайти на сервер

```powershell
ssh -i "$env:USERPROFILE\.ssh\linguolab_deploy" root@79.143.176.220
```

### Контейнеры / логи

```bash
docker ps --filter 'name=linguolab_'
docker logs --tail 50 linguolab_api
docker logs -f linguolab_api
```

### Рестарт после деплоя

```bash
cd /opt/linguolab/compose
docker compose pull linguolab_api && docker compose up -d linguolab_api
```

### Nginx reload

```bash
docker exec main_nginx nginx -t
docker exec main_nginx nginx -s reload
```

### CI/Deploy

```powershell
gh run list --limit 5
gh run view <ID> --log-failed
gh workflow run deploy-api.yml --ref main
```

### Git flow

```powershell
# Работа на develop
git checkout develop && git pull
# ... изменения + коммит ...
git push

# Создать PR
gh pr create --base main --head develop --title "feat(X): ..." --body "..."
# После merge в main:
git pull origin develop --no-edit
git push origin develop
```

### Prisma

```powershell
cd apps/api
pnpm prisma migrate dev --name <name>
pnpm prisma generate
pnpm prisma studio
pnpm prisma db seed
```

### Локальная разработка

```powershell
pnpm install
pnpm --filter @linguolab/web dev
pnpm --filter @linguolab/api start:dev
pnpm --filter @linguolab/admin dev
pnpm format
```

### Обновить .env на сервере

```bash
# Пример — один ключ:
sed -i 's/^TELEGRAM_BOT_TOKEN=.*$/TELEGRAM_BOT_TOKEN=NEW_TOKEN/' /opt/linguolab/compose/.env
cd /opt/linguolab/compose && docker compose up -d linguolab_api
```

---

## 14. Что НЕЛЬЗЯ делать

### 🚫 Не трогать соседние контейнеры

`main_nginx` (reload только через `nginx -s reload`, не `down`), `linkbetter_bot`, `flowershop_*`.

### 🚫 Не публиковать порты 5432, 6379 наружу

Только в `linguolab_internal` сети.

### 🚫 Не хардкодить секреты в коде

Всё через `process.env.X` + ConfigService.

### 🚫 Не пушить напрямую в `main`

Branch protection + PR-only.

### 🚫 Не вставлять секреты в чат

Bot token, JWT secrets, R2 keys — никогда. Если случайно — сразу revoke.

### 🚫 Не использовать `--no-verify` или пропускать commitlint

Если commit-msg падает — поправить по Conventional Commits + укоротить строки до 100 символов.

### 🚫 Не трогать Origin Cert без бэкапа

`/opt/linguolab/certs/origin.{pem,key}` — перед изменением `cp -p origin.pem origin.pem.bak.$(date +%F)`.

### 🚫 Не игнорировать pnpm `onlyBuiltDependencies`

Новый native-пакет (bcrypt, sharp и т.п.) — добавить в `pnpm-workspace.yaml` И `package.json:pnpm.onlyBuiltDependencies`.

---

## Финал

**Новый workflow (с этапа 23+, после 29.05.2026):**

После каждой существенной задачи:

1. `git add` + `git commit` + `git push origin main` (напрямую, без PR)
2. CI/CD автоматически:
   - Deploy Web (через scp на сервер)
   - Deploy API (через GHCR Docker image → docker-compose pull)
3. Локальный manual деплой Web если нужен быстрее CI/CD — см. раздел «Деплой Web вручную» в `SESSION_SUMMARY.md`

При закрытии этапа:

1. Все галки в `README.md`
2. Запись в `project_progress.md` со статусом `✅ Завершён` + детали
3. Коммит `docs: close etap N` + push (или включить в feat-commit)
4. Обновить `HANDOFF.md` секции 8 (что сделано) и 9 (текущий этап)
5. Обновить `SESSION_SUMMARY.md` если изменились критичные технические детали

---

## 📝 Протокол обновления документации (обязательно)

Документация — это история проекта. Без неё следующая сессия не сможет понять что произошло. **Полная спецификация:** `docs/NEW_SESSION_PROMPT.json` → `doc_maintenance_protocol`.

### Когда обновлять что

| Изменение | Какие MD обновлять |
|---|---|
| Опечатка / мелкий фикс | ничего, только commit кода |
| Новая страница / фича | `SESSION_SUMMARY.md` + `project_progress.md` + `README.md` |
| Изменение архитектуры / стека | `HANDOFF.md` + `project_progress.md` + `README.md` |
| Закрытие этапа / группы задач | `[x]` в `README.md` + запись в `project_progress.md` + обнови `SESSION_SUMMARY.md` |
| Изменение deploy workflow | `HANDOFF.md` + `SESSION_SUMMARY.md` (раздел «Деплой Web вручную») |
| Новый MD или переименование | `README.md` (структура) + `HANDOFF.md` (раздел 4) + `NEW_SESSION_PROMPT.json` |
| Принципиальное изменение архитектуры продукта | Поднять версию `docs/PLAN_FINAL.md` (v6/v7) |

### Зоны ответственности файлов

- **`HANDOFF.md`** — контекст для новой сессии. Краткие сводки. Обновлять верх (дата + список изменений).
- **`project_progress.md`** — детальный дневник. Добавлять новые секции `## ✅ Этап N — Название` в конец. Структура: Статус / Дата / Цель / Что сделано (с путями файлов) / Коммиты.
- **`SESSION_SUMMARY.md`** — сводка ТЕКУЩЕЙ большой сессии. Перезаписывай секцию `✅ Сделано` после закрытия группы задач. Обновляй список последних коммитов.
- **`README.md`** — чеклист этапов (GitHub главная). Помечай `[x]` пункты. Добавляй `### Этап N` если объём оправдывает.
- **`PLAN_FINAL.md`** — целевой план продукта (НЕ дневник). Менять только при смене стека/удалении модуля.
- **`NEW_SESSION_PROMPT.json`** — промпт для следующей сессии. Обновлять `current_state.stage` + `remaining_tasks` после каждой существенной задачи.

### Анти-паттерны

- ❌ Не накапливай 10 несинхронизированных изменений кода без обновления docs.
- ❌ Не дублируй одну запись в `HANDOFF` и `project_progress` (HANDOFF — сводка, progress — детали).
- ❌ Не пиши `TODO: обновить docs` — обновляй сразу.
- ❌ Не пропускай `NEW_SESSION_PROMPT.json` — это контракт для следующей сессии.

### Шаблон коммита для doc-обновлений

```
docs: close stage 27 + update HANDOFF and project_progress
docs: sync README checkboxes after CSV export feature
docs: update SESSION_SUMMARY with latest commits
```

**Доступные источники истины:**

- `README.md` — высокоуровневый чеклист по этапам
- `project_progress.md` — детальный дневник (этапы 0.5 – 26)
- `SESSION_SUMMARY.md` — что сделано в последней большой сессии
- `HANDOFF.md` — контекст проекта, технологии, конвенции

Удачи, новая сессия. Не задавай вопросов — здесь всё есть.
