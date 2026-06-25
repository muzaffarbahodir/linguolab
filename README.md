# LinguoLab

Языковой центр как **Telegram Web App**.

- **TWA frontend:** React + Vite + `@twa-dev/sdk` → `https://app-linguolab.muzaffarbahodir.uz`
- **API:** NestJS + Prisma + PostgreSQL + Redis → `https://api-linguolab.muzaffarbahodir.uz`
- **Админка:** Next.js → `https://admin-linguolab.muzaffarbahodir.uz`
- **CDN/Storage:** Cloudflare R2 → `https://cdn-linguolab.muzaffarbahodir.uz`
- **Уведомления:** Telegram Bot API (push не используем)
- **Платежи:** Payme + Click + Uzumbank (UZS, тийины), фискализация через Soliq.uz

Полная архитектура и план: [`docs/PLAN_FINAL.md`](docs/PLAN_FINAL.md).

---

## Стек

| Слой     | Технологии                                                                             |
| -------- | -------------------------------------------------------------------------------------- |
| Frontend | React 18, Vite, TS, Tailwind, TanStack Query, Zustand, `@twa-dev/sdk`, React Router v6 |
| Backend  | NestJS, Prisma, BullMQ, grammY, `@aws-sdk/client-s3` (R2), Sentry, OpenTelemetry       |
| Admin    | Next.js 14 (App Router), NextAuth, recharts                                            |
| DB       | PostgreSQL 16 + Redis 7                                                                |
| Инфра    | Docker, Docker Compose, Nginx, Cloudflare (DNS/WAF/R2/SSL)                             |
| CI/CD    | GitHub Actions                                                                         |
| Монорепо | pnpm workspaces + Turborepo                                                            |

---

## Структура

```
linguolab/
├── apps/
│   ├── web/                # TWA (React + Vite)
│   │   └── src/            # pages/, api/, hooks/, components/, store/
│   ├── api/                # NestJS
│   │   ├── prisma/         # schema.prisma, migrations/, seed.ts
│   │   └── src/            # modules/, common/, prisma/, redis/
│   └── admin/              # Next.js 14 App Router
├── packages/               # зарезервировано (ui/types — позже)
├── infra/
│   └── nginx/conf.d/       # vhost-конфиги для main_nginx на сервере
├── .github/workflows/
├── docs/                   # PLAN_FINAL.md, HANDOFF.md, project_progress.md,
│                           # SESSION_SUMMARY.md, LAUNCH.md,
│                           # PAYMENT_FISCALIZATION_PROMPT.md,
│                           # NEW_SESSION_PROMPT.json (контракт для новой сессии)
└── .env.example
```

---

## Локальный запуск

Требования:

- Node.js 22+
- pnpm 11+
- Docker + Docker Compose
- Аккаунт в Telegram + бот (`@BotFather`)

```bash
git clone https://github.com/artsoftmuzaffarkhon/linguolab.git
cd linguolab
pnpm install
cp .env.example .env
# заполнить .env
pnpm dev
```

---

## TODO — этапы разработки

Прогресс по `PLAN_FINAL.md`:

### Этап 0.5 — Инфраструктура

- [x] DNS A-записи (app/api/admin/cdn) на Cloudflare
- [x] Origin Cert wildcard (15 лет)
- [x] R2 bucket `linguolab-files` + CORS + custom domain
- [x] `/opt/linguolab/{nginx,certs,web/dist,backups,compose}` на VPS
- [x] 3 nginx vhost-конфига + интеграция в `main_nginx`
- [x] `linguolab_postgres` + `linguolab_redis` в сети `linguolab_internal`
- [x] GitHub repo + ветки `main` + `develop`
- [x] Локальный монорепо skeleton + Husky + commitlint
- [x] CI workflow (`.github/workflows/ci.yml`) — первый запуск зелёный
- [x] Branch protection на `main` (PR-only + required CI status check)
- [x] Deploy workflows (web/api/admin) — после Этапа 1

### Этап 1 — Скелет приложений

- [x] `apps/web/` — Vite + React + TS + Tailwind + `@twa-dev/sdk` + Router + Tabs
- [x] `apps/api/` — NestJS + Prisma + первая миграция (users, languages)
- [x] `apps/admin/` — Next.js skeleton
- [x] `WebApp.ready()` + `WebApp.expand()` + theme vars
- [x] BottomNav (4 пункта)
- [x] Deploy workflows (web/api/admin) + публично HTTP/2 200

### Этап 2 — Auth через Telegram initData

- [x] `TelegramInitDataValidator` (HMAC-SHA256, auth_date ≤24ч)
- [x] `POST /auth/telegram/init` + JWT issuance + refresh (Redis rotation chain)
- [x] Гварды: `JwtAuthGuard`, `RolesGuard`, `AdminGuard`, `SuperAdminOnlyGuard`
- [x] `POST /auth/admin/login` (email+password, MANAGER/ADMIN/SUPER_ADMIN)
- [x] Frontend: auto-init при mount + zustand auth store + axios interceptor 401→retry
- [x] Admin: NextAuth credentials provider + refresh в jwt callback

### Этап 3 — Home + Profile

- [x] `GET /users/me`, `/users/me/progress`, `/languages`, `/lessons/upcoming`
- [x] HomeScreen (приветствие, прогресс 65%, языки, ближайший урок, quick-actions кнопка)
- [x] ProfileScreen (аватар Telegram, прогресс 70%, меню, смена языка)

### Этап 4 — Каталог + классы

- [x] `courses` + `classes` API + сидинг (2 учителя, 6 классов)
- [x] `GET /classes?languageId=&level=`, `GET /classes/:id`, `POST /classes/:id/enroll`
- [x] Courses.tsx — карточки с фильтром по языку

### Этап 5 — Флоу записи (3 шага)

- [x] Stepper Язык → Класс → Подтверждение (BookingPage)
- [x] `POST /classes/:id/enroll` (Enrollment, 409 дубль, 400 нет мест)
- [x] Telegram `BackButton` между шагами, Schedule tab из Этапа 5

### Этап 6 — Telegram-бот

- [x] grammY webhook-режим: `/start` + InlineKeyboard открыть TWA
- [x] `notifyEnrolled()` — уведомление при записи (fire-and-forget)
- [x] Webhook `/telegram/webhook` + secret header

### Этап 7 — Telegram-группы для классов

- [x] `Class.telegram_chat_id BigInt?` — менеджер привязывает группу
- [x] `sendGroupInvite()` — одноразовый invite link при одобрении заявки
- [x] `PATCH /enrollments/:id/status` — одобрить/отклонить (MANAGER+)
- [x] Admin: `/enrollments` список заявок + кнопки + `/classes` привязка группы
- [x] `RolesGuard` глобально как второй APP_GUARD

### Этап 8 — Расписание (новый таб)

- [x] `schedule_days String[]`, `schedule_time String?`, `schedule_duration Int?` в Class
- [x] `PATCH /classes/:id/schedule` (MANAGER+)
- [x] `GET /lessons/upcoming` — реальный расчёт ближайшего урока UTC+5
- [x] Schedule.tsx — EnrollmentCard с расписанием + ближайший урок
- [x] Admin: `SetScheduleForm` — выбор дней + время + длительность

### Этап 9 — Quick actions

- [x] BottomSheet компонент (переиспользуемый)
- [x] QuickActionsSheet — 3 экрана: пробный урок / поддержка / реферал
- [x] `POST /trial-lessons/request`, `POST /support/tickets`, `GET /referrals/my`
- [x] Home: кнопка ⚡ открывает sheet
- [x] `POST /placement-tests/*` — start/answer/complete/my (реализовано в Этапе 11)

### Этап 10 — ДЗ + достижения + R2 Storage

- [x] `POST /storage/presigned-upload` — R2 presigned PUT URL (TTL 15m)
- [x] HomeworkModule: create/list/submit (R2 upload) / grade + AchievementsModule triggers
- [x] PDF-сертификаты: pdfkit → R2 → Certificate record

### Этап 11 — Платежи UZ (Payme + Click + Uzumbank)

- [x] `POST /payments/checkout` — идемпотентный (idempotency_key UUID)
- [x] Payme JSON-RPC (6 методов: Check/Create/Perform/Cancel/CheckTransaction/GetStatement, Basic Auth)
- [x] Click Prepare + Complete (HMAC-MD5 signature)
- [x] Uzumbank (заглушка URL)
- [x] Webhooks @Public + payment.paid trigger: enrollment ACTIVE + TG invite
- [x] AdminModule: dashboard/students/teachers/classes/users+role CRUD
- [x] TWA: Payment.tsx — выбор провайдера + WebApp.openLink + история платежей

### Этап 11.5 — Фискализация Soliq

- [ ] `SoliqClient` + auth (refresh при 401)
- [ ] `FiscalReceiptBuilder` (VAT 12%, тийины)
- [ ] BullMQ queue `fiscal-send` + ретраи (1м/5м/30м/2ч/12ч/24ч)
- [ ] REFUND-чеки при adminRefund()
- [ ] `GET /fiscal/receipt/:id`, `POST /fiscal/receipt/:id/retry` (ADMIN+)

### Этап 12 — Уведомления (TG)

- [x] `TelegramNotificationChannel` (grammY)
- [x] BullMQ scheduler (за 1ч до урока, новое ДЗ, чек, оплата, отмена)
- [x] Дедуп через Redis SETEX
- [x] Статусные уведомления: enrollment confirmed/dropped, trial confirmed/cancelled, support ticket updated, certificate issued (этап 25)

### Этап 12.5 — Модуль «Родители»

- [x] `parent_child_links` + `parent_link_invites`
- [x] Привязка через 6-значный код / deep-link
- [x] Гранулярные `permissions` JSON
- [x] Read-only `/parents/children/:id/{schedule,homework,attendance,progress,overview}`
- [x] TG-уведомления родителю (пропуск урока, просрочка ДЗ)
- [x] ParentChild TWA: вкладки Overview/Attendance/Homework, рейтинг в классе, уровень CEFR

### Этап 12.7 — Личный кабинет учителя в TWA

- [x] TWA-навигация для TEACHER (TeacherHome с виджетами «сегодня/ДЗ/классы»)
- [x] `POST /lessons/:id/attendance/bulk` — реализовано
- [x] `PATCH /homework/submissions/:id/grade` — реализовано
- [x] `POST /homework` (для класса) — реализовано
- [x] TWA-страницы: `TeacherHome`, `TeacherClass`, `TeacherAttendance`, `TeacherSubmissions`, `TeacherPendingHw`, `TeacherStudentPage`, `TeacherStats`, `TeacherProfilePage`
- [x] Редактирование bio + соц. ссылок (BottomSheet)
- [x] Виджет «сегодняшние уроки» с progress посещаемости
- [x] Выставление оценки ДЗ (модал)

### Этап 12.9 — Onboarding + Retention

- [x] Welcome-флоу (Onboarding 3 шага)
- [x] Placement test API (start/answer/complete) — реализовано
- [x] Cron-кампании retention (`RetentionProcessor`: inactive_students 10:00 UTC, homework_overdue 07:00 UTC)
- [x] Реферальная карточка (Profile + QuickActionsSheet, copy code, redeem foreign code)
- [x] Реферальная аналитика для админа (`/admin/referrals` — конверсия, топ рефереров)

### Этап 13 — Админка v2

- [x] Дашборд-виджеты — `GET /admin/dashboard/widgets` (7 счётчиков)
- [x] CRUD студентов/учителей/классов — реализовано (`AdminStudents`, `AdminTeachers`, `AdminClasses`)
- [x] Управление ролями — `PATCH /admin/users/:id/role` с защитой от эскалации
- [x] audit_log (`AdminAudit.tsx`)
- [x] Broadcast TG по сегментам (`AdminBroadcast.tsx`)
- [x] Экспорт CSV (`/admin/students/export`, `/admin/payments/export` — кнопки в `AdminStudents` + `AdminFinance`)
- [x] Settings провайдеров (`AdminPaymentSettings.tsx` — toggle PAYME/CLICK/UZUMBANK)
- [x] TWA admin UI (`apps/web/src/pages/admin/*` — 12 страниц вместо отдельной Next.js админки)
- [x] Зачисления (`AdminEnrollments` — PENDING→ACTIVE/DROPPED + статусные TG-уведомления)
- [x] Переводы (`AdminTransfers` — одобрить/отклонить)
- [x] Пробные уроки (`AdminTrials`)
- [x] Поддержка (`AdminSupport`)
- [x] Выдача сертификатов (`AdminCertificates` — по классу + глобальный поиск)
- [x] Бейджи учителей (`AdminTeachers` → BadgeSheet с пресет-иконками)
- [x] Расписание классов (`AdminClasses` → ScheduleForm: дни + время + длительность)

### Этап 13.5 — Аналитика

- [ ] `analytics_events` партицированный (по месяцам) — TODO
- [ ] 6 materialized views — TODO
- [x] `/admin/analytics/*` endpoints (revenue, students, enrollments funnel)
- [x] SVG bar charts в `AdminAnalytics.tsx` (вместо recharts — lightweight inline SVG)
- [x] `AnalyticsEvent` модель + `AnalyticsService` (track login/enroll, fire-and-forget)
- [x] Weekly PDF-отчёт SUPER_ADMIN'у (cron Sunday 03:00, pdfkit, R2 upload)

### Этап 14 — Тесты + CI/CD финал

- [ ] Unit (провайдеры, RBAC guards) — TODO
- [ ] Integration (Supertest, mock Telegram via nock) — TODO
- [x] E2E Playwright (TWA auth mock — page.addInitScript + page.route)
- [x] Sentry — API (@sentry/nestjs), Portal (@sentry/nextjs), Web (@sentry/react)

### Этап 23 — Расширенная админка (5/26)

- [x] `AdminTeachers` — CRUD + бейджи (preset icons + award/remove)
- [x] `AdminClasses` — CRUD + архивация + расписание (PATCH /classes/:id/schedule)
- [x] `AdminAnalytics` — SVG charts (revenue/students/enrollments funnel)
- [x] `AdminEnrollments` — PENDING→ACTIVE/DROPPED + restore + tabs
- [x] `AdminCertificates` — выбор класса или глобальный поиск студентов
- [x] `AdminPaymentSettings` — toggle PAYME/CLICK/UZUMBANK
- [x] `AdminReferrals` — конверсия + топ рефереров (`GET /referrals/admin/stats`)

### Этап 24 — Учитель + i18n полный (5/26)

- [x] `TeacherStats` — 4 карточки + per-class student stat grid
- [x] i18n 3 языка (`ru / en / uz`) — все секции, ~700 строк JSON
- [x] Применено в: Support, Attendance, AdminReferrals, AdminEnrollments,
      TeacherStats, AdminPaymentSettings, AdminAnalytics, AdminClasses, AdminTeachers
- [x] `useLanguage.ts` → `applyLocale()` → DOM-event для re-render

### Этап 25 — Статусные TG-уведомления + CSV (5/26)

- [x] `notification.types.ts` — 6 новых типов (ENROLLMENT*\*, TRIAL*\*, SUPPORT_TICKET_UPDATED, CERTIFICATE_ISSUED)
- [x] `notifications.service.ts` — 6 новых `schedule*()` методов
- [x] Inject `NotificationsService` в 4 сервиса (enrollments/support/trial-lessons/certificates)
- [x] Регистрация `NotificationsModule` в 4 модулях
- [x] CSV экспорт UI: `AdminStudents` + `AdminFinance` (ADMIN+)
- [x] Глобальный поиск студентов в `AdminCertificates` (через `useAdminStudents`)
- [x] `GET /referrals/admin/stats` — реферальная аналитика

### Этап 26 — UX полировка + Code splitting (5/26)

- [x] `BottomSheet` — `createPortal(document.body)` обход stacking context
- [x] Свайп вниз > 80px → закрыть
- [x] Удалён × close button, остался handle bar
- [x] Zustand `useUIStore.bottomSheetOpen` → `App.tsx` скрывает BottomNav
- [x] `lazy()` для всех non-critical pages → bundle 657kb → 422kb (-35%)
- [x] `Suspense` + `PageLoader` для plain transitions
- [x] `Courses.tsx` — секция «Мои заявки на пробный урок» с badge статусов
- [x] `Payment.tsx` — инвойс с ACTIVE enrollments + кнопка «💳 Оплатить»

---

## Конвенции

### Коммиты

**Conventional Commits** обязательны (enforced via commitlint):

```
feat(auth): telegram initData verification
fix(payments): correct HMAC-SHA1 for Click
chore(repo): bump turbo to 2.4
docs(readme): add deployment notes
```

Типы: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`, `style`, `revert`.

### Ветки

- `main` — prod, защищена. Только PR.
- `develop` — интеграция. Фичи мержатся сюда.
- Фичи: `feat/etap-X-описание` или просто прямо в `develop`.

### PR

- Squash-merge в `main`.
- CI должен пройти (lint + unit + format).

---

## Лицензия

UNLICENSED — частный проект.
