# PLAN_FINAL — LinguoLab

> Единый источник правды. Версия v5 (TWA + Cloudflare + UZ-платежи + Soliq + Родители + Учитель + Аналитика + Onboarding/Retention).
> Зона: **`linguolab.muzaffarbahodir.uz`**.

---

## 1. ФИНАЛЬНЫЙ СТЕК

### Frontend (TWA)
- **React 18 + Vite + TypeScript**
- `@twa-dev/sdk` — обязательное API Telegram WebApp
- React Router v6
- TanStack Query (react-query) + axios
- Zustand (без persist; критичный стейт через `WebApp.CloudStorage`)
- Tailwind CSS (тема через CSS-vars из `var(--tg-theme-*)`)
- recharts — графики (для админки и учительских стат)
- i18next — `ru/uz/en`, default из `WebApp.initDataUnsafe.user.language_code`

### Backend
- **NestJS + TypeScript**
- Prisma ORM
- PostgreSQL 16 (основная БД, materialized views для аналитики)
- Redis 7 (cache, rate-limit, BullMQ-очереди, retention SETEX-дедуп)
- BullMQ — фискализация ретраи, ретеншн-кампании, броадкаст, аналитика-tracking
- grammY — Telegram-бот
- `@aws-sdk/client-s3` — клиент к Cloudflare R2 (S3-совместимый)
- Sentry + OpenTelemetry — observability

### Admin
- **Next.js 14 (App Router) + TypeScript**
- NextAuth (credentials provider → `/auth/admin/login`)
- recharts для дашбордов
- Деплой как Docker-контейнер

### Инфраструктура
- Cloudflare DNS / WAF / R2 / SSL (Full strict, Origin Cert wildcard 15 лет)
- VPS Ubuntu 22.04, IP `79.143.176.220`
- Docker + Docker Compose
- nginx (`main_nginx` контейнер, общий с другими проектами; добавляем bind-mount конфиги)
- GitHub Actions — CI/CD, push в `main` → auto-deploy в prod
- pnpm + Turborepo — монорепо

---

## 2. СУБДОМЕНЫ И МАРШРУТИЗАЦИЯ

| Субдомен | Что | Куда проксируется | Cloudflare proxy |
|----------|-----|-------------------|------------------|
| `app-linguolab.muzaffarbahodir.uz` | TWA frontend (статика Vite) | `main_nginx` → `/usr/share/nginx/linguolab-web` | DNS-only сейчас → orange после теста |
| `api-linguolab.muzaffarbahodir.uz` | NestJS API | `main_nginx` → `linguolab_api:3000` | DNS-only сейчас → orange после теста |
| `admin-linguolab.muzaffarbahodir.uz` | Next.js админка | `main_nginx` → `linguolab_admin:3001` | DNS-only сейчас → orange после теста |
| `cdn-linguolab.muzaffarbahodir.uz` | R2 (аватары, ДЗ, сертификаты, чеки) | Cloudflare R2 (`linguolab-files`, регион WEUR) | **Orange (обязательно)** |

**SSL:** Cloudflare Universal SSL + Origin Certificate (wildcard `*.linguolab.muzaffarbahodir.uz`, 15 лет, RSA 2048). Положение на сервере: `/opt/linguolab/certs/origin.pem`, `/opt/linguolab/certs/origin.key` (chmod 600).

**Режим SSL/TLS в CF:** Full (strict).

**CORS R2:** разрешён `https://app-linguolab.muzaffarbahodir.uz`, методы `GET/PUT/POST/HEAD`.

---

## 3. АРХИТЕКТУРА МОНОРЕПО

```
linguolab/
├── apps/
│   ├── web/                 # TWA (React + Vite)
│   ├── admin/               # Next.js
│   └── api/                 # NestJS
├── packages/
│   ├── ui/                  # шеринг компонентов между web/admin
│   ├── types/               # DTO, enums, money helpers (тийины)
│   ├── eslint-config/
│   └── tsconfig/
├── infra/
│   ├── nginx/conf.d/        # app/api/admin .conf
│   ├── docker-compose.prod.yml
│   └── certs/               # CF Origin Cert (gitignored, кладётся на сервер)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── .github/workflows/
│   ├── ci.yml               # lint + unit на каждый push
│   ├── deploy-web.yml       # main → rsync статики на VPS
│   ├── deploy-api.yml       # main → docker build → push GHCR → SSH → compose up
│   └── deploy-admin.yml
├── .husky/                  # pre-commit, commit-msg
├── .env.example
├── turbo.json
├── pnpm-workspace.yaml
└── README.md                # на русском, с TODO-списком этапов
```

### Структура `apps/api/src/`
```
modules/
├── auth/                    # JWT + telegram-init + admin-login
├── users/
├── courses/
├── classes/
├── teachers/                # teacher cabinet endpoints
├── bookings/
├── schedule/
├── lessons/
├── homework/
├── achievements/
├── payments/                # IPaymentProvider + factory + Payme/Click/Uzumbank
├── fiscal/                  # Soliq
├── subscriptions/
├── telegram/                # бот grammY + webhook
├── notifications/           # каналы: TG primary, email secondary
├── storage/                 # R2 client
├── parents/                 # parent-child links + permissions
├── onboarding/
├── retention/               # cron-кампании
├── analytics/               # tracking + aggregates + reports
├── admin/                   # dashboard, audit-log, broadcast, export, settings
└── referrals/

common/
├── auth/guards/             # jwt, roles, teacher-owns-*, parent-access, manager-scope, super-admin-only
├── interceptors/            # audit-log, request-logger
├── pipes/
├── decorators/              # @Roles, @RequiresPermission, @TrackEvent
└── filters/

config/
prisma/
```

### Структура `apps/web/src/`
```
main.tsx                     # WebApp.ready(), expand, themeParams
App.tsx                      # Router + RoleSwitch layout
pages/
├── Onboarding/              # WelcomeScreen, ChooseLanguage, ChooseLevel, TrialOffer
├── Home.tsx
├── Schedule/
├── Courses/
├── Booking/                 # Step1Course, Step2Class, Step3Confirm
├── Profile/                 # Profile, Parents, AcceptParentLink, Referrals
├── Payment/                 # ProviderSelect, WaitingResult
├── Parent/                  # ChildrenList, ChildDashboard, ChildSchedule, ChildHomework, LinkChild
└── Teacher/                 # Schedule, MyClasses, ClassDetail, AttendanceForm, HomeworkCreate, HomeworkGrade, MyStats, Profile
components/
├── BottomNav.tsx
├── ProgressBar.tsx
├── LessonCard.tsx
├── EventCard.tsx
├── ReceiptCard.tsx
├── Stepper.tsx
├── teacher/                 # StudentRow, AttendanceCheckbox, GradeInput
hooks/
├── useTelegramUser.ts
├── useInitData.ts
├── useMainButton.ts
├── useBackButton.ts
├── useThemeParams.ts
├── useUserRole.ts
└── useCurrentChild.ts
api/                         # axios + react-query
store/                       # zustand (auth, currentChild, bookingDraft)
lib/
├── twa.ts                   # обёртка @twa-dev/sdk
├── cloudStorage.ts
└── money.ts                 # тийин ↔ UZS helpers
i18n/                        # ru/uz/en
theme/                       # CSS vars
```

### Структура `apps/admin/`
```
app/
├── (dashboard)/
│   ├── page.tsx             # виджеты главной
│   ├── students/
│   ├── teachers/
│   ├── classes/
│   ├── courses/
│   ├── payments/
│   ├── fiscal/
│   ├── parents/
│   ├── users/               # role management
│   ├── audit-log/
│   ├── broadcast/
│   ├── analytics/           # с подразделами financial/students/teachers/parents
│   ├── settings/            # provider on/off, VAT, feature flags
│   └── export/
└── api/auth/[...nextauth]/route.ts
components/charts/           # KPICard, RevenueChart, FunnelChart, ChurnChart, ProviderBreakdown
```

---

## 4. СХЕМА БД (PostgreSQL / Prisma)

### Енумы
```prisma
enum Role            { STUDENT TEACHER MANAGER PARENT ADMIN SUPER_ADMIN }
enum CEFR            { A1 A2 B1 B2 C1 C2 }
enum CourseType      { GENERAL CONVERSATION IELTS KIDS }
enum BookingStatus   { PENDING CONFIRMED COMPLETED CANCELLED }
enum LessonFormat    { ONLINE OFFLINE }
enum HomeworkStatus  { PENDING SUBMITTED GRADED OVERDUE }
enum AchievementType { CERTIFICATE BADGE }
enum SubscriptionStatus { ACTIVE EXPIRED CANCELLED }
enum PaymentProvider { PAYME CLICK UZUMBANK }
enum PaymentStatus   { PENDING AUTHORIZED PAID CANCELLED REFUNDED FAILED EXPIRED }
enum FiscalStatus    { PENDING SENT CONFIRMED FAILED REFUNDED }
enum ReceiptType     { SALE REFUND }
enum ParentLinkStatus{ PENDING CONFIRMED REVOKED }
enum ParentRelation  { PARENT GUARDIAN OTHER }
enum InviterRole     { PARENT CHILD ADMIN }
enum ChurnState      { ACTIVE AT_RISK CHURNED REACTIVATED }
enum NotificationAudience { SELF PARENT_OF_CHILD TEACHER MANAGER }
```

### Таблицы

1. **users** — id, telegram_user_id (BIGINT UNIQUE NOT NULL), telegram_username, telegram_linked_at, email?, phone?, password_hash? (только ADMIN), first_name, last_name, avatar_url, role (Role), locale, timezone, country (default UZ), tin? (для юрлиц), tg_init_data_hash?, onboarded_at?, placement_level (CEFR)?, last_active_at, churn_state, tg_blocked (bool), token_version (int, для JWT инвалидации), created_at, updated_at

2. **languages** — id, code (en/es/fr/zh/uz), name_ru, flag_emoji, color

3. **courses** — id, language_id→FK, title, description, type (CourseType), level (CEFR), level_label, price_tiyin (BigInt), vat_rate (Int default 12), duration_min, is_active

4. **classes** — id, course_id→FK, teacher_id→FK, name, schedule_rrule, telegram_group_id?→FK, max_students, starts_on, ends_on
   - индексы: `(course_id, teacher_id)`

5. **class_members** — class_id, user_id, joined_at, telegram_user_id, tg_active (bool)
   - PK: (class_id, user_id), index `(user_id)`

6. **telegram_groups** — id, course_id?→FK, class_id?→FK, level (CEFR)?, invite_link, chat_id (BIGINT), title, is_active, created_at

7. **teachers** — id, user_id→FK UNIQUE, bio, hourly_rate, rating_avg, is_native

8. **teacher_languages** — teacher_id, language_id (m2m, PK составной)

9. **enrollments** — id, user_id→FK, course_id→FK, progress_pct, current_level (CEFR), started_at

10. **bookings** — id, user_id→FK, class_id→FK, status (BookingStatus), is_trial (bool), format (LessonFormat), created_at
    - индекс: `(user_id, status)`

11. **lessons** — id, class_id→FK, starts_at, ends_at, meeting_url, notes
    - индекс: `(class_id, starts_at)`

12. **lesson_attendance** — lesson_id, user_id, attended (bool), note?, created_at
    - PK: (lesson_id, user_id)

13. **homework** — id, lesson_id?→FK, class_id→FK, title, description, due_at, attachments (Json)

14. **homework_submissions** — id, homework_id→FK, user_id→FK, content?, files (Json: R2-keys), submitted_at, status (HomeworkStatus), grade?, feedback?, graded_by_user_id?

15. **achievements** — id, user_id→FK, type (AchievementType), title, level (CEFR)?, issued_at, file_url

16. **subscriptions** — id, user_id→FK, plan, started_at, expires_at, status (SubscriptionStatus)

17. **payments** — id, user_id→FK, subscription_id?→FK, course_id?→FK, class_id?→FK, payer_user_id?→FK (для родителя), amount_tiyin (BigInt), vat_amount_tiyin (BigInt), vat_rate (Int default 12), currency (default UZS), provider (PaymentProvider), provider_txn_id?, provider_state?, status (PaymentStatus), idempotency_key UNIQUE, payload_in (Json)?, payload_out (Json)?, fiscal_receipt_id? UNIQUE → FK, paid_at?, created_at, updated_at
    - индексы: `(user_id, status)`, `(provider, provider_txn_id)`

18. **fiscal_receipts** — id, payment_id UNIQUE → FK, status (FiscalStatus), receipt_type (ReceiptType), fiscal_sign?, fiscal_number?, receipt_url?, total_tiyin (BigInt), vat_tiyin (BigInt), items (Json), request_payload (Json)?, response_payload (Json)?, attempts (Int default 0), last_error?, sent_at?, created_at, updated_at
    - индекс: `(status, attempts)`

19. **payment_providers_config** — id, provider (PaymentProvider) UNIQUE, is_enabled (bool), display_order, config (Json: лого, отображаемое имя), updated_at

20. **webhook_events** — id, provider (PaymentProvider), external_id, signature?, raw_body (Json), processed (bool), processed_at?, error?, created_at
    - UNIQUE `(provider, external_id)`, индекс `(processed, created_at)`

21. **notifications** — id, user_id→FK, type, payload (Json), channel (TG/EMAIL), audience (NotificationAudience), subject_user_id?→FK (для уведомлений родителю о ребёнке), read_at?, created_at

22. **referrals** — id, inviter_id→FK, invitee_id?→FK, code UNIQUE, redeemed_at?, bonus_days_granted (int)?

23. **support_tickets** — id, user_id→FK, subject, body, status, created_at

24. **parent_child_links** — id, parent_user_id→FK, child_user_id→FK, relation (ParentRelation), status (ParentLinkStatus), permissions (Json: schedule/homework/attendance/progress/grades/payments/chat), invited_by (InviterRole), confirmed_at?, revoked_at?, created_at, updated_at
    - UNIQUE `(parent_user_id, child_user_id)`, индексы `(child_user_id)`, `(parent_user_id, status)`

25. **parent_link_invites** — id, code UNIQUE (6 цифр), initiated_by→FK, initiator_role (InviterRole), target_user_id?, expires_at, consumed_at?, consumed_by?, link_id?→FK, created_at
    - индексы `(code)`, `(expires_at)`

26. **placement_tests** — id, user_id→FK, started_at, completed_at?, score?, level_assigned (CEFR)?, answers (Json)

27. **retention_campaigns_log** — id, user_id→FK, campaign_key (D3_NO_BOOKING / D7_INACTIVE / D14_INACTIVE / SUB_EXPIRING_3 / SUB_EXPIRED), sent_at, clicked_at?, converted_at?

28. **audit_log** — id, actor_user_id→FK, action, resource_type, resource_id, before_payload (Json)?, after_payload (Json)?, ip, user_agent, created_at
    - индексы `(actor_user_id, created_at)`, `(resource_type, resource_id)`

29. **analytics_events** — id, user_id?→FK, session_id, event_type, payload (Json), ip?, ua?, created_at
    - **PARTITION BY RANGE (created_at) MONTH**
    - индексы `(event_type, created_at)`, `(user_id, created_at)`

30. **feature_flags** — id, key UNIQUE, value (Json), description, updated_at

### Materialized Views (для аналитики)
- `mv_revenue_daily` — дневная выручка + разбивка по провайдерам
- `mv_active_students_daily` — DAU/WAU/MAU
- `mv_class_fill_rate` — занято/максимум по классам
- `mv_teacher_load_weekly` — часов в неделю по преподу
- `mv_funnel_weekly` — registered → booked → paid → attended
- `mv_churn_monthly` — % отток

REFRESH: каждые 15 мин (CONCURRENTLY где возможно), тяжёлые — ночью.

### Миграции (последовательность)
```
20260510_init
20260511_telegram_auth
20260512_courses_classes
20260513_bookings_lessons_homework
20260514_payments_v1
20260515_uz_payments_providers      # Payme/Click/Uzumbank, BigInt тийины
20260516_fiscal_receipts            # Soliq + status enum
20260517_webhook_events
20260518_payment_providers_config
20260519_drop_legacy_payment_fields
20260520_parent_module
20260521_roles_extended             # MANAGER, SUPER_ADMIN
20260522_onboarding_retention       # users.onboarded_at, last_active_at, churn_state
20260523_audit_log
20260524_analytics_events_partitioned
20260525_materialized_views
20260526_feature_flags
```

---

## 5. API ENDPOINTS (полный список)

### Auth
- `POST /auth/telegram/init` — body `{initData}`, верифицирует HMAC-SHA256 + auth_date ≤24ч, возвращает JWT-пару
- `POST /auth/refresh`
- `POST /auth/admin/login` — email+password (только ADMIN/SUPER_ADMIN/MANAGER)
- `POST /auth/logout`

### Users
- `GET /users/me`
- `PATCH /users/me`
- `GET /users/me/progress`
- `POST /users/me/avatar` (presigned R2)

### Storage (R2)
- `POST /storage/presigned-upload` — body `{kind: AVATAR|HOMEWORK|CERT, content_type}` → presigned PUT (TTL 15 мин)
- `POST /storage/confirm`

### Languages / Courses / Teachers / Classes
- `GET /languages`
- `GET /courses?language=&level=&type=`
- `GET /courses/:id`
- `GET /classes?course_id=`
- `GET /classes/:id`
- `POST /classes/:id/enroll`
- `GET /classes/:id/members`
- `GET /teachers?course_id=&language=`
- `GET /teachers/:id`

### Bookings
- `POST /bookings` — `{class_id, format, is_trial}`
- `GET /bookings`
- `GET /bookings/:id`
- `PATCH /bookings/:id/cancel`

### Schedule
- `GET /schedule?from=&to=`
- `GET /schedule/today`

### Lessons / Homework / Achievements
- `GET /lessons/upcoming`
- `GET /lessons/history`
- `GET /lessons/:id`
- `GET /homework?status=`
- `POST /homework/:id/submit`
- `GET /achievements`
- `GET /achievements/:id/certificate` (PDF из R2)

### Teacher Cabinet
- `GET /teachers/me/classes`
- `GET /teachers/me/schedule?from=&to=`
- `GET /teachers/me/students`
- `GET /classes/:id/students` (TeacherOwnsClassGuard)
- `GET /classes/:id/lessons`
- `GET /lessons/:id/attendance`
- `POST /lessons/:id/attendance/bulk` — `[{user_id, attended, note?}]`
- `POST /classes/:id/homework`
- `PATCH /homework/:id/grade` — `{user_id, grade, feedback?}`
- `GET /homework/:id/submissions`
- `GET /teachers/me/stats?period=week|month`

### Parents
- `POST /parents/link/invite` — `{initiator_role, permissions}` → `{code, deep_link}`
- `POST /parents/link/redeem` — `{code}`
- `GET /parents/me/children`
- `GET /parents/children/:childId/schedule?from=&to=`
- `GET /parents/children/:childId/homework?status=`
- `GET /parents/children/:childId/attendance?from=&to=`
- `GET /parents/children/:childId/progress`
- `PATCH /parents/links/:linkId/permissions`
- `DELETE /parents/links/:linkId`
- `GET /students/me/parents`

### Payments
- `POST /payments/checkout` — `{provider, course_id?, class_id?, subscription_plan?, idempotency_key}`
- `POST /payments/payme/webhook` — JSON-RPC 2.0, Basic Auth
- `POST /payments/click/prepare`
- `POST /payments/click/complete`
- `POST /payments/uzumbank/callback`
- `GET /payments/history`
- `GET /payments/:id`
- `GET /payments/last-pending` (для возврата из чекаута)

### Fiscal
- `GET /fiscal/receipt/:id`
- `POST /fiscal/receipt/:id/retry` (ADMIN)

### Telegram
- `POST /telegram/webhook` — основной от бота
- `POST /telegram/link/start` (legacy, для не-TWA фолбэка) → deep-link
- `POST /telegram/link/callback`
- `GET /telegram/groups/my`
- `POST /classes/:id/telegram/join` — одноразовый invite-link

### Notifications
- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /users/me/notification-channels`

### Onboarding / Retention
- `POST /onboarding/complete`
- `GET /onboarding/state`
- `POST /placement-tests/start`
- `POST /placement-tests/:id/answer`

### Quick actions
- `POST /trial-lessons/request`
- `POST /referrals/invite`
- `POST /support/tickets`

### Admin (RBAC: ADMIN/SUPER_ADMIN/MANAGER где указано)
- `GET /admin/dashboard/widgets`
- `GET/POST/PATCH/DELETE /admin/students` (MANAGER+)
- `GET/POST/PATCH/DELETE /admin/teachers` (MANAGER+)
- `GET/POST/PATCH/DELETE /admin/classes` (MANAGER+)
- `GET/POST/PATCH /admin/courses` (MANAGER+)
- `GET /admin/payments` (MANAGER read-only, ADMIN+ full)
- `POST /admin/payments/:id/refund` (ADMIN+)
- `GET /admin/users` (ADMIN+)
- `PATCH /admin/users/:id/role` (ADMIN — кроме ADMIN/SUPER_ADMIN, SUPER_ADMIN — все)
- `GET /admin/audit-log` (MANAGER read-only, ADMIN+ read, SUPER_ADMIN delete)
- `POST /admin/notifications/broadcast`
- `GET /admin/export?resource=&format=`
- `GET/PATCH /admin/settings`
- `GET/PATCH /admin/payment-providers/config` (SUPER_ADMIN only)

### Analytics (ADMIN/SUPER_ADMIN, financial — SUPER_ADMIN)
- `GET /admin/analytics/revenue?from=&to=&group_by=`
- `GET /admin/analytics/revenue/by-provider`
- `GET /admin/analytics/avg-check`
- `GET /admin/analytics/ltv?cohort=`
- `GET /admin/analytics/conversion`
- `GET /admin/analytics/refunds`
- `GET /admin/analytics/churn`
- `GET /admin/analytics/students/registrations`
- `GET /admin/analytics/students/active?window=`
- `GET /admin/analytics/students/funnel`
- `GET /admin/analytics/students/at-risk`
- `GET /admin/analytics/students/top`
- `GET /admin/analytics/attendance/by-class`
- `GET /admin/analytics/classes/fill-rate`
- `GET /admin/analytics/courses/popularity`
- `GET /admin/analytics/teachers/load`
- `GET /admin/analytics/parents/active-links`
- `GET /admin/analytics/parents/engagement`

---

## 6. ЭТАПЫ РАЗРАБОТКИ

### Этап 0.5 — Инфраструктура
**Цель:** домены резолвятся, SSL валиден, R2 принимает upload, nginx раздаёт заглушку, CI/CD выкатывает контейнер.

**Действия:**
1. DNS A-записи (3) + R2 custom domain (CNAME) — **сделано пользователем**
2. CF Origin Cert wildcard 15 лет — **сделано**
3. R2 bucket `linguolab-files` (WEUR) + CORS + token — **сделано**
4. На сервере создать `/opt/linguolab/{nginx/conf.d,certs,web/dist,backups}`
5. Положить Origin Cert: `/opt/linguolab/certs/origin.{pem,key}` (chmod 600 на key, owner root)
6. Написать 3 vhost-конфига (см. раздел Nginx)
7. Добавить `include` в `/opt/nginx/nginx.conf`, добавить mount в compose `main_nginx`
8. Проверить `nginx -t` внутри контейнера, reload
9. Поднять `linguolab_postgres`, `linguolab_redis` в новой compose-сети
10. GitHub repo `artsoftmuzaffarkhon/linguolab` (public), ветки `main` + `develop`
11. Workflow `.github/workflows/{ci,deploy-web,deploy-api,deploy-admin}.yml`
12. Secrets в GitHub: `SSH_HOST`, `SSH_USER`, `SSH_PASSWORD`, `GHCR_TOKEN`, `R2_*`, `JWT_*`, `TELEGRAM_BOT_TOKEN`, и т.д.

**Файлы:**
- `infra/nginx/conf.d/{app,api,admin}.linguolab.conf`
- `infra/docker-compose.prod.yml`
- `.github/workflows/*.yml`
- `.env.example`
- `README.md` (RU + TODO-список этапов)

**Результат:** `https://api-linguolab.muzaffarbahodir.uz/health` → `200 ok`, `https://app-linguolab.muzaffarbahodir.uz` → заглушка.

---

### Этап 1 — Скелет приложений

- pnpm + Turborepo init, ESLint strict TS + Prettier, Husky (pre-commit, commit-msg + commitlint), lint-staged
- `apps/web/`: Vite + React + TS, `@twa-dev/sdk`, React Router, Tailwind, react-query, zustand
- `apps/api/`: NestJS + Prisma init + первая миграция (users, languages)
- `apps/admin/`: Next.js skeleton
- `WebApp.ready()`, `WebApp.expand()`, тема через CSS-vars
- BottomNav (4 пункта, иконки SVG)
- Файлы: `apps/web/src/{main.tsx,App.tsx,components/BottomNav.tsx,theme/index.css}`, `apps/api/src/main.ts`, `prisma/schema.prisma`

**Коммит:** `chore(repo): init monorepo with web/api/admin skeletons`

**Результат:** TWA открывается в Telegram, рисует 4 пустые страницы с навигацией.

---

### Этап 2 — Auth через Telegram initData

- NestJS: `AuthModule`, `TelegramInitDataValidator` (HMAC-SHA256), `POST /auth/telegram/init`, JWT issuance + refresh
- Гварды: `JwtAuthGuard`, `TelegramInitDataGuard`, `RolesGuard`, `AdminGuard`, `SuperAdminOnlyGuard`
- Admin login (`/auth/admin/login`) с bcrypt
- Frontend: `/auth/telegram/init` при mount `App.tsx`, токен в zustand (in-memory)
- При 401 — повторная инициализация
- Файлы: `modules/auth/{auth.module,auth.service,auth.controller,telegram-init.validator,guards/{jwt,tma,roles,admin,super-admin-only}}.ts`, `apps/web/src/api/client.ts`, `apps/web/src/store/auth.ts`, `apps/web/src/hooks/useUserRole.ts`

**Коммит:** `feat(auth): telegram initData verification + JWT issuance`

---

### Этап 3 — Home + Profile

- API: `/users/me`, `/users/me/progress`, `/languages`, `/lessons/upcoming`, `/notifications`
- Pages: `Home.tsx`, `Profile/Profile.tsx`
- Компоненты HTML+CSS: ProgressBar, LanguageBubble, LessonCard, TrialBanner
- Аватар = `WebApp.initDataUnsafe.user.photo_url`

**Коммит:** `feat(home,profile): main screens with progress + nearest lesson`

---

### Этап 4 — Каталог + классы

- API: `/courses`, `/classes`, `/teachers`
- Сидинг: курсы из макета + 2-3 класса на курс с RRULE
- Pages: `pages/Courses.tsx`, `pages/CourseDetail.tsx`

**Коммит:** `feat(courses): catalog with classes per course + seed`

---

### Этап 5 — Флоу записи (3 шага)

- Stepper: Курс → Класс → Подтверждение, `WebApp.MainButton` для CTA
- API: `POST /bookings`
- Pages: `pages/Booking/{Step1Course,Step2Class,Step3Confirm}.tsx`, `components/Stepper.tsx`, `store/bookingDraft.ts`

**Коммит:** `feat(booking): 3-step booking flow with MainButton`

---

### Этап 6 — Telegram-бот

- grammY: команды `/start`, `/app` (открывает TWA через `web_app_url`), `/mygroups`
- Webhook на `/telegram/webhook`
- Файлы: `modules/telegram/{telegram.module,bot/{commands,handlers},webhook.controller}.ts`

**Коммит:** `feat(telegram): bot with /start /app commands`

---

### Этап 7 — Telegram-группы для классов

- `createChatInviteLink` (`member_limit=1`, TTL 24ч)
- Webhook `chat_member` — kick не-членов
- Файлы: `modules/telegram/group-sync.service.ts`, `modules/classes/classes.controller.ts` (`/classes/:id/telegram/join`)

**Коммит:** `feat(telegram): one-time invite links + member sync`

---

### Этап 8 — Расписание (новый таб)

- API `/schedule` агрегирует уроки + ДЗ-дедлайны + пробные
- TWA: `react-big-calendar` или CSS-grid, день/неделя/месяц
- Pages: `pages/Schedule/*`

**Коммит:** `feat(schedule): unified calendar view`

---

### Этап 9 — Quick actions

- BottomSheet «Что хотите сделать?»: trial, placement test, referral, support
- Endpoints: `/trial-lessons/request`, `/placement-tests/*`, `/referrals/invite`, `/support/tickets`

**Коммит:** `feat(quick-actions): trial / test / referral / support modal`

---

### Этап 10 — ДЗ + достижения + Storage R2

- Модуль `storage/` (S3 client с R2 endpoint)
- `/storage/presigned-upload` (TTL 15 мин), `/storage/confirm`
- Frontend: `<input type="file">` → fetch PUT на presigned URL
- Сертификаты: PDF-генерация на бэке → R2 → ссылка через cdn

**Коммит:** `feat(storage,homework): R2 presigned uploads + homework submissions`

---

### Этап 11 — Платежи UZ (Payme + Click + Uzumbank)

**Подэтапы:**
1. Миграции БД, `IPaymentProvider`, factory, сидинг `payment_providers_config`
2. Payme провайдер (JSON-RPC 6 методов, Basic Auth, idempotency)
3. Click провайдер (Prepare + Complete, HMAC-SHA1)
4. Uzumbank провайдер (заглушка-совместимая, `is_enabled=false`)
5. TWA — экран выбора провайдера + `WebApp.openLink`
6. Webhooks gateway, idempotency через `WebhookEvent`, эмиттер `payment.paid`, привязка к классам/TG (триггер инвайта)

**Коммит:** `feat(payments): UZ providers (Payme/Click/Uzumbank stub) + idempotent webhooks`

---

### Этап 11.5 — Фискализация Soliq

- `SoliqAuthService` (Bearer + auto-refresh при 401)
- `SoliqClient` (HTTP над `https://ofd.soliq.uz`, sandbox `https://ofd-test.soliq.uz`)
- `FiscalReceiptBuilder` (расчёт VAT 12%, items[], тийины)
- BullMQ `fiscal-send` worker, ретраи 1м/5м/30м/2ч/12ч/24ч
- `FiscalNotificationService` (TG + email)
- REFUND-чеки

**Коммит:** `feat(fiscal): Soliq receipts with retry queue + TG/email delivery`

---

### Этап 12 — Telegram-уведомления

- `NotificationService` + `TelegramNotificationChannel` (`bot.api.sendMessage`)
- Email-fallback (если задан)
- BullMQ scheduler для напоминаний (за 1ч до урока, новое ДЗ, чек, оплата, отмена)
- Дедуп через Redis SETEX

**Коммит:** `feat(notifications): TG channel + email fallback + BullMQ scheduler`

---

### Этап 12.5 — Модуль «Родители»

**Подэтапы:**
1. Миграция: enum `PARENT`, таблицы `parent_child_links`, `parent_link_invites`
2. Привязка (3 флоу): родитель→ребёнок (deep-link), ребёнок→родитель, admin вручную
3. `permissions` JSON (расширяемо), `ParentAccessGuard`
4. Read-only API: `/parents/children/:id/{schedule,homework,attendance,progress}`
5. TWA: `pages/Parent/*`, `pages/Profile/{Parents,AcceptParentLink}.tsx`, нав `Дети|Расписание|Уведомления|Профиль`
6. Уведомления родителю: пропуск урока (BullMQ +10 мин), просрочка ДЗ (cron 30 мин), низкая оценка (event), истечение подписки. Дедуп Redis 24ч

**Коммит:** `feat(parents): parent-child linking with granular permissions + TG notifications`

---

### Этап 12.7 — Личный кабинет учителя в TWA

- Нав для TEACHER: `Расписание | Мои классы | Студенты | Профиль`
- API: `/teachers/me/{classes,schedule,students,stats}`, `POST /lessons/:id/attendance/bulk`, `PATCH /homework/:id/grade`, `POST /classes/:id/homework`
- Гварды `TeacherOwnsClassGuard`, `TeacherOwnsLessonGuard`
- Pages: `pages/Teacher/*`, `components/teacher/*`
- Уведомления учителю: за 30 мин до урока, новая сдача ДЗ, серия пропусков

**Коммит:** `feat(teacher): TWA cabinet — schedule, classes, attendance, homework, grading`

---

### Этап 12.9 — Onboarding + Retention

- Welcome-флоу: WelcomeScreen → ChooseLanguage → ChooseLevel → TrialOffer
- Placement test (15 вопросов, скоринг → CEFR)
- Поля: `users.{onboarded_at, placement_level, last_active_at, churn_state, tg_blocked}`
- Таблица `retention_campaigns_log`
- Cron-кампании: D+3 / D+7 / D+14 / D+30 churn-маркер / sub_expiring_3 / sub_expired
- Реферальная карточка `pages/Profile/Referrals.tsx` (`WebApp.switchInlineQuery`)
- Лимит 1 push/день/юзер, soft-stop при `403 bot blocked`
- Файлы: `modules/onboarding/*`, `modules/retention/{retention.module,retention.service,jobs/*,templates/}`, `pages/Onboarding/*`, `pages/Profile/Referrals.tsx`

**Коммит:** `feat(onboarding,retention): 3-step welcome + placement test + retention crons`

---

### Этап 13 — Админка (Next.js) v2

- Дашборд-виджеты (выручка сегодня, новые студенты, уроки, незакрытые оплаты, failed фискализация, алерты)
- Управление ролями (ADMIN не выдаёт ADMIN/SUPER_ADMIN)
- Audit log + interceptor `AuditLogInterceptor` для всех `POST/PATCH/DELETE` под `/admin/*`
- Broadcast TG по сегментам (все / курс X / класс X / неоплатившие / неактивные / SQL для SUPER_ADMIN)
- Экспорт CSV/XLSX (студенты, платежи, посещаемость)
- Settings (провайдеры on/off, VAT, feature flags, шаблоны TG)
- MANAGER-режим: скрыты финансы, refund, роли, провайдеры
- Деплой `admin-linguolab.muzaffarbahodir.uz`

**Коммит:** `feat(admin): dashboard, role mgmt, audit log, broadcast, export, settings`

---

### Этап 13.5 — Аналитика

- `analytics_events` партицированный (по месяцам), fire-and-forget BullMQ
- 6 materialized views (REFRESH 15 мин)
- Endpoints `/admin/analytics/*`
- Recharts-дашборды: сводный + financial + students + teachers + parents
- Weekly PDF SUPER_ADMIN'у в TG (puppeteer, cron Mon 09:00)
- statement_timeout=5s для analytics роли

**Коммит:** `feat(analytics): events pipeline + materialized views + recharts dashboards`

---

### Этап 14 — Тесты + CI/CD финал

- Unit: провайдеры, FiscalService, TelegramInitDataValidator, RBAC guards
- Integration: Supertest, mock Telegram/Soliq через `nock`
- e2e TWA: Playwright + stub `window.Telegram.WebApp`
- e2e сценарий: открыть TWA → auth → выбрать класс → оплата (mock Payme) → инвайт TG (mock) → чек Soliq (mock sandbox)
- CI: lint + unit на каждый push (`develop` + `main`), e2e только на `main`
- Sentry web + api, OpenTelemetry бэк

**Коммит:** `test(ci): full coverage + Playwright e2e on main`

---

## 7. DOCKER COMPOSE АРХИТЕКТУРА

### Сети
- **`shared_web`** (external, существующая) — общая с `main_nginx`. Подключаются: `linguolab_api`, `linguolab_admin`.
- **`linguolab_internal`** (внутренняя) — изолирует БД и Redis. Подключаются: `linguolab_postgres`, `linguolab_redis`, `linguolab_api`, `linguolab_admin`.

`linguolab_api` и `linguolab_admin` — в обеих сетях (multi-network).

### Контейнеры (`infra/docker-compose.prod.yml`)

```
services:
  linguolab_api:
    image: ghcr.io/artsoftmuzaffarkhon/linguolab-api:latest
    container_name: linguolab_api
    restart: unless-stopped
    networks: [shared_web, linguolab_internal]
    env_file: .env.prod
    depends_on: [linguolab_postgres, linguolab_redis]
    volumes:
      - linguolab_api_logs:/app/logs

  linguolab_admin:
    image: ghcr.io/artsoftmuzaffarkhon/linguolab-admin:latest
    container_name: linguolab_admin
    restart: unless-stopped
    networks: [shared_web, linguolab_internal]
    env_file: .env.prod
    depends_on: [linguolab_api]

  linguolab_postgres:
    image: postgres:16-alpine
    container_name: linguolab_postgres
    restart: unless-stopped
    networks: [linguolab_internal]
    environment:
      POSTGRES_DB: linguolab
      POSTGRES_USER: linguolab
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - linguolab_postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U linguolab"]
      interval: 10s

  linguolab_redis:
    image: redis:7-alpine
    container_name: linguolab_redis
    restart: unless-stopped
    networks: [linguolab_internal]
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - linguolab_redis_data:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a ${REDIS_PASSWORD} ping"]
      interval: 10s

volumes:
  linguolab_postgres_data:
  linguolab_redis_data:
  linguolab_api_logs:

networks:
  shared_web:
    external: true
  linguolab_internal:
    driver: bridge
```

### Volumes (на хосте)
- `/opt/linguolab/web/dist` — собранная статика TWA (rsync из CI)
- `/opt/linguolab/nginx/conf.d/*.conf` — наши vhost
- `/opt/linguolab/certs/origin.{pem,key}` — CF Origin Cert
- `/opt/linguolab/backups/` — дампы Postgres (cron daily → R2 раз в неделю)
- Named volumes Docker: `linguolab_postgres_data`, `linguolab_redis_data`, `linguolab_api_logs`

### Бэкапы Postgres
- Cron `0 3 * * *` на хосте: `docker exec linguolab_postgres pg_dump -U linguolab linguolab | gzip > /opt/linguolab/backups/$(date +\%F).sql.gz`
- Retention: 14 дней локально + еженедельный sync в R2 в bucket `linguolab-backups` (отдельный)

---

## 8. NGINX ПЛАН

### Существующий main_nginx (Mounts)
```
/opt/nginx/nginx.conf            → /etc/nginx/nginx.conf (RO)
/opt/flowershop/frontend/dist    → /usr/share/nginx/flowershop (RO)
/var/www/certbot                 → /var/www/certbot (RO)
/etc/letsencrypt                 → /etc/letsencrypt (RO)
```

### Новые mount'ы (добавляются в compose `main_nginx`)
```
/opt/linguolab/nginx/conf.d      → /etc/nginx/conf.d/linguolab (RO)
/opt/linguolab/certs             → /etc/nginx/certs/linguolab (RO)
/opt/linguolab/web/dist          → /usr/share/nginx/linguolab-web (RO)
```

### Изменение `/opt/nginx/nginx.conf`
Внутри `http {}` добавить **одну строку** перед существующими `server`-блоками:
```nginx
include /etc/nginx/conf.d/linguolab/*.conf;
```

### `/opt/linguolab/nginx/conf.d/app.linguolab.conf`
```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app-linguolab.muzaffarbahodir.uz;

    ssl_certificate     /etc/nginx/certs/linguolab/origin.pem;
    ssl_certificate_key /etc/nginx/certs/linguolab/origin.key;

    root /usr/share/nginx/linguolab-web;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Immutable cache на хешированные ассеты
    location ~* \.(js|css|woff2|svg|png|jpg|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1000;

    # security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}

server {
    listen 80;
    listen [::]:80;
    server_name app-linguolab.muzaffarbahodir.uz;
    return 301 https://$host$request_uri;
}
```

### `/opt/linguolab/nginx/conf.d/api.linguolab.conf`
```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api-linguolab.muzaffarbahodir.uz;

    ssl_certificate     /etc/nginx/certs/linguolab/origin.pem;
    ssl_certificate_key /etc/nginx/certs/linguolab/origin.key;

    client_max_body_size 25M;

    location / {
        proxy_pass http://linguolab_api:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_read_timeout 60s;
    }

    # Webhook endpoints — увеличенный таймаут для Soliq
    location ~ ^/(payments|telegram)/.*/webhook$ {
        proxy_pass http://linguolab_api:3000;
        proxy_read_timeout 30s;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name api-linguolab.muzaffarbahodir.uz;
    return 301 https://$host$request_uri;
}
```

### `/opt/linguolab/nginx/conf.d/admin.linguolab.conf`
```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin-linguolab.muzaffarbahodir.uz;

    ssl_certificate     /etc/nginx/certs/linguolab/origin.pem;
    ssl_certificate_key /etc/nginx/certs/linguolab/origin.key;

    location / {
        proxy_pass http://linguolab_admin:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name admin-linguolab.muzaffarbahodir.uz;
    return 301 https://$host$request_uri;
}
```

### Применение
```
docker exec main_nginx nginx -t       # проверка
docker exec main_nginx nginx -s reload
```

---

## 9. ENV ПЕРЕМЕННЫЕ (`.env.example`)

```ini
# === App ===
NODE_ENV=production
APP_PUBLIC_URL=https://app-linguolab.muzaffarbahodir.uz
API_PUBLIC_URL=https://api-linguolab.muzaffarbahodir.uz
ADMIN_PUBLIC_URL=https://admin-linguolab.muzaffarbahodir.uz
CDN_PUBLIC_URL=https://cdn-linguolab.muzaffarbahodir.uz

# === Database ===
DATABASE_URL=postgresql://linguolab:CHANGE_ME@linguolab_postgres:5432/linguolab
POSTGRES_PASSWORD=CHANGE_ME            # openssl rand -base64 48 | tr -d '/+='
REDIS_URL=redis://:CHANGE_ME@linguolab_redis:6379
REDIS_PASSWORD=CHANGE_ME

# === JWT ===
JWT_SECRET=CHANGE_ME                   # openssl rand -hex 64
JWT_REFRESH_SECRET=CHANGE_ME           # openssl rand -hex 64
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# === Telegram ===
TELEGRAM_BOT_TOKEN=CHANGE_ME           # после revoke от @BotFather
TELEGRAM_BOT_USERNAME=linguolab_bot
TELEGRAM_WEBHOOK_SECRET=CHANGE_ME      # openssl rand -hex 32
TELEGRAM_WEB_APP_URL=https://app-linguolab.muzaffarbahodir.uz

# === Cloudflare R2 ===
R2_ACCOUNT_ID=CHANGE_ME
R2_ACCESS_KEY_ID=CHANGE_ME
R2_SECRET_ACCESS_KEY=CHANGE_ME
R2_BUCKET_NAME=linguolab-files
R2_PUBLIC_URL=https://cdn-linguolab.muzaffarbahodir.uz
R2_ENDPOINT=https://CHANGE_ME.r2.cloudflarestorage.com

# === Payme (sandbox) ===
PAYME_MERCHANT_ID=
PAYME_SECRET_KEY=
PAYME_TEST_SECRET_KEY=
PAYME_ENDPOINT=https://checkout.paycom.uz
PAYME_USE_SANDBOX=true

# === Click (sandbox) ===
CLICK_SERVICE_ID=
CLICK_MERCHANT_ID=
CLICK_SECRET_KEY=
CLICK_ENDPOINT=https://my.click.uz/services/pay

# === Uzumbank (заглушка) ===
UZUMBANK_MERCHANT_ID=
UZUMBANK_SECRET_KEY=
UZUMBANK_ENDPOINT=

# === Soliq (sandbox) ===
SOLIQ_API_URL=https://ofd.soliq.uz
SOLIQ_SANDBOX_URL=https://ofd-test.soliq.uz
SOLIQ_USE_SANDBOX=true
SOLIQ_TIN=
SOLIQ_PASSWORD=
SOLIQ_TERMINAL_ID=
SOLIQ_MERCHANT_ID=
SOLIQ_VAT_RATE=12

# === Email (skip — TG основной) ===
SMTP_URL=
EMAIL_FROM=no-reply@linguolab.muzaffarbahodir.uz

# === Sentry ===
SENTRY_DSN=
SENTRY_DSN_WEB=

# === Misc ===
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
LOG_LEVEL=info
```

---

## 10. РОЛИ И RBAC

### Роли (`Role` enum)
| Роль | Контекст |
|------|----------|
| `STUDENT` | ученик в TWA |
| `TEACHER` | преподаватель в TWA + частично админка |
| `MANAGER` | сотрудник центра — операционка, без финансов |
| `PARENT` | родитель в TWA |
| `ADMIN` | администратор центра |
| `SUPER_ADMIN` | владелец |

### Матрица доступа
| Возможность | STUDENT | TEACHER | MANAGER | PARENT | ADMIN | SUPER_ADMIN |
|-------------|:-:|:-:|:-:|:-:|:-:|:-:|
| TWA: запись на класс | ✅ | — | — | — | — | — |
| TWA: своё расписание | ✅ | ✅ свои уроки | — | child | ✅ | ✅ |
| TWA: оценки за ДЗ | — | ✅ свои классы | — | — | ✅ | ✅ |
| TWA: посещаемость | — | ✅ свои уроки | — | — | ✅ | ✅ |
| TWA: студенты класса | — | ✅ свои | — | — | ✅ | ✅ |
| TWA: видеть детей | — | — | — | ✅ | — | — |
| Admin: создание классов | — | — | ✅ | — | ✅ | ✅ |
| Admin: создание курсов | — | — | ✅ заявка | — | ✅ | ✅ |
| Admin: платежи | — | — | RO | — | ✅ | ✅ |
| Admin: refund | — | — | — | — | ✅ | ✅ |
| Admin: рассылка | — | — | по сегментам | — | ✅ | ✅ + SQL |
| Admin: дашборд | — | — | без финансов | — | ✅ | ✅ |
| Admin: финансовая аналитика | — | — | — | — | ✅ | ✅ |
| Admin: управление ролями | — | — | — | — | ✅ кроме ADMIN/SA | ✅ |
| Admin: создание ADMIN | — | — | — | — | — | ✅ |
| Admin: настройка провайдеров | — | — | — | — | — | ✅ |
| Admin: audit log | — | — | view | — | view | view+delete |
| Admin: settings | — | — | — | — | partial | ✅ |

### Гварды (NestJS)
- `JwtAuthGuard` — любой авторизованный
- `RolesGuard` — `@Roles(Role.X)`
- `TeacherOwnsClassGuard` / `TeacherOwnsLessonGuard` — TEACHER только свои
- `ParentAccessGuard` — link + scope
- `ManagerScopeGuard`
- `SuperAdminOnlyGuard`

### ABAC слой
`@RequiresPermission('payments.refund')`, `@RequiresPermission('analytics.financial')`, `@RequiresPermission('users.role.assign:ADMIN')`. SUPER_ADMIN — единственный с `users.role.assign:SUPER_ADMIN`.

### Защита от привилегии-эскалации
- ADMIN не выдаёт ADMIN/SUPER_ADMIN
- Self-edit роли запрещён
- Каждая смена роли → audit_log + TG-нотификация всем SUPER_ADMIN
- При смене роли `users.token_version++`, JWT инвалидируется

### TWA — `<RoleSwitch>`
- STUDENT (default): `Главная | Расписание | Занятия | Профиль`
- TEACHER: `Расписание | Мои классы | Студенты | Профиль`
- PARENT: `Дети | Расписание | Уведомления | Профиль`
- Совмещение ролей → переключатель в шапке

---

## 11. ЗАВИСИМОСТИ ЭТАПОВ

```
0.5 → 1
1 → 2
2 → 3, 4, 6, 9, 12.5(part), 12.9(part)
3 → (зависим от 2)
4 → 5, 12.7
5 → 8, 10, 11
6 → 7, 12, 12.5(deep-link)
7 ← 4, 6 ; триггерится из 11
8 ← 5
9 ← 2 ; параллельно
10 ← 5, 0.5(R2)
11 ← 2, 4, 7 ; триггерит 11.5
11.5 ← 11
12 ← 6
12.5 ← 2, 6, 8, 10, 12
12.7 ← 4, 5, 8, 10
12.9 ← 2, 6, 9, 10, 12
13 ← 4, 11, 12.5, 12.7
13.5 ← 2, 4, 5, 10, 11, 11.5, 12, 12.5, 12.7
14 — сквозной
```

**Параллельные треки после 2:**
- A: 3 → 4 → 5 → 8 → 10 → 12.5
- B: 6 → 7
- C: 11 → 11.5
- D: 12.7 (после 4)
- E: 12.9 (после 12)
- F: 13 → 13.5

---

## 12. РИСКИ (полный список)

### Базовые (TG-группы, БД)
1. **Часовые пояса** — UTC в БД, `users.timezone`, `date-fns-tz`, тесты на DST
2. **Платежи РФ-санкции** — мульти-провайдер (UZ-only решение убирает риск)
3. **Гонки бронирования** — `SELECT ... FOR UPDATE` + idempotency-key
4. **Push-токены протухают** — n/a (TG)
5. **WebSocket масштаб** — n/a (нет WS)
6. **Загрузка больших файлов** — presigned R2, лимит 10MB
7. **i18n** — `i18next`, fallback ru
8. **CEFR-прогресс** — enum + `progress_pct` 0-100, авто-апгрейд
9. **Apple/Google ревью** — n/a (TWA, не store-app)
10. **Безопасность чата** — n/a (TG-группы вместо встроенного чата)
11. **Юзер не привязал TG** — auth через initData = всегда привязан
12. **TG Bot API лимиты** — BullMQ + rate-limiter
13. **Юзер вышел из TG-группы** — `chat_member` webhook, флаг `tg_active=false`, переинвайт
14. **Утечка invite-link** — `member_limit=1`, `expires_in=24h`

### Платежи + фискализация
15. **Soliq API недоступен** — Payment=PAID независимо, BullMQ ретраи 1м/5м/30м/2ч/12ч/24ч, после 6 фейлов алерт SUPER_ADMIN
16. **Дублирование чека** — `webhook_events.unique(provider, external_id)`
17. **Неверный TIN/terminal_id** — health-check на старте, fail deploy если sandbox down
18. **Payme замороз CheckTransaction WAITING** — таймаут 30 мин, BullMQ `payment-timeout`, CancelTransaction
19. **Click Prepare прошёл, Complete не пришёл** — cron `orphan-click-prepare` каждые 10 мин, отмена через 1ч
20. **НДС-ставка изменилась** — `vat_rate` снапшотом в Payment, новые из ENV/feature flag
21. **Тийины vs сомы перепутали** — `BigInt`, никогда `Float`, линтер запрет `amount_cents`, helper `lib/money.ts`
22. **Юзер передумал** — PENDING → CANCELLED через 30 мин
23. **Refund** — REFUND-чек в Soliq со ссылкой на исходный
24. **Sandbox vs Prod** — флаг `*_USE_SANDBOX`, баннер `[SANDBOX MODE]`, CI-проверка

### TWA + Cloudflare
25. **initData TTL 24ч** — фронт ловит 401 → повторный init
26. **WebView CSS квирки** — feature-detect через `WebApp.version`, fallback на 100% вместо dvh
27. **Юзер закрыл TWA во время оплаты** — webhook завершит платёж, при возврате — `/payments/last-pending`
28. **R2 presigned URL истёк** — TTL 15 мин, retry-кнопка
29. **WebApp.CloudStorage лимит 1024×4KB** — туда только UI-настройки
30. **MainButton конфликт между формами** — `useMainButton` с registry + cleanup
31. **CF кэширует API** — `Cache-Control: no-store` + Page Rule Bypass
32. **VPS SPOF** — daily snapshot, hourly Postgres → R2 backup, UptimeRobot → TG алерты
33. **CF orange ломает webhook'и** — WAF allow IP-диапазонов провайдеров
34. **TWA local testing** — cloudflared tunnel
35. **Origin Cert не в публичном CA** — health-check через CF, не напрямую

### Родители
36. **Чужой человек привязался** — invite TTL 15 мин, одноразовый, confirm-экран обеим сторонам
37. **Ребёнок не хочет видеть оценки родителю** — granular permissions JSON, ребёнок отзывает scope
38. **Спам родителю при 10 ДЗ** — Redis SETEX-дедуп 24ч, дайджест-режим
39. **Родитель без TG** — fallback email
40. **Несколько родителей** — m2m, шлём всем CONFIRMED
41. **Каскад при удалении ребёнка** — `onDelete: Cascade` или soft через `revoked_at`

### Роли и RBAC
42. **Привилегии-эскалация** — `users.role.assign:SUPER_ADMIN` только у SA, self-edit запрещён, audit + TG-алерт SA
43. **Учитель видит чужой класс** — `TeacherOwnsClassGuard`, тесты 403
44. **MANAGER видит финансы прямым URL** — `RolesGuard` на бэке (источник истины)
45. **Старый JWT после смены роли** — `token_version++`, force relogin
46. **DDoS на /admin** — CF rate-limit, WAF Bot Fight Mode

### Аналитика
47. **`analytics_events` террабайты** — партиции по месяцу, BullMQ-запись, архивация в R2 parquet >12 мес
48. **MV stale** — REFRESH 15 мин (CONCURRENTLY), бейдж «обновлено N мин назад» на UI
49. **Дашборд кладёт прод** — только MV, `statement_timeout=5s` для analytics-роли, slow-query log
50. **PII в payload** — schema-валидация перед записью, линтер запрет email/phone/имя
51. **Несогласованность счётчиков** — для revenue считаем из платёжных таблиц, не из events

### Onboarding / Retention
52. **Спам ретеншн → блок бота** — лимит 1 push/день/юзер, soft-stop при `403 bot blocked`, `users.tg_blocked=true`
53. **Onboarding не пройден, юзер пользуется** — auto-skip через 7 дней
54. **Реферальный фрод** — блок по `telegram_user_id`, бонус только после первого PAID

---

## 13. ПРЕДПОЧТЕНИЯ ПО РАБОТЕ

### Git
- **Ветки:** `main` + `develop`. Фичи — PR из `develop` → `main`. Прямой push в `main` запрещён (branch protection).
- **Коммиты:** мелкие, по подэтапам. **Conventional Commits** обязательны:
  - `feat:` — новая фича
  - `fix:` — баг-фикс
  - `chore:` — конфиги, инфра, deps
  - `docs:` — документация
  - `test:` — тесты
  - `refactor:` — без изменения поведения
  - `perf:` — оптимизация
  - `ci:` — CI/CD изменения
- **Pre-commit:** Husky + lint-staged + commitlint.
- **PR:** squash-merge в main с автогенерацией changelog.

### CI/CD
- `.github/workflows/ci.yml` — lint + unit на каждый push в любую ветку
- `.github/workflows/deploy-*.yml` — на push в `main` → auto-deploy в prod (rsync статики + docker pull + compose up)
- e2e (Playwright) — только на push в `main` (медленно)
- Staging — **не нужен**

### Линт / формат
- ESLint `strict` TypeScript-eslint config
- Prettier стандарт (80-char, single quotes, no semi optional)
- Tailwind классы — отсортированы через `prettier-plugin-tailwindcss`

### Стиль кода
- Подробные комментарии (для обучения), особенно в нетривиальных местах: HMAC-валидация, JSON-RPC Payme, fiscal retry, RBAC guards
- JSDoc на публичных API (NestJS controllers, exported functions)
- README на русском, с актуальным TODO-списком этапов

### Сервер
- Команды на сервер — **пошагово**, копипастишь и присылаешь вывод

### Прогресс
- TODO-список в `README.md` (markdown checklist), обновляется при закрытии каждого подэтапа

---

## 14. ИНФРА — ФАКТЫ

### GitHub
- Username: `artsoftmuzaffarkhon`
- Repo: `artsoftmuzaffarkhon/linguolab` — public, новый, создаётся в Этапе 0.5
- Ветки: `main`, `develop`
- Branch protection на `main`: PR-only, status checks (CI ci.yml), 0 approvals (solo dev)

### Сервер
- IP: `79.143.176.220`
- SSH: `root` + пароль (для Этапа 0.5; на финале — желательно ключ)
- OS: Ubuntu 22.04.5
- Docker 29.4.2, Compose v5.1.3
- RAM 11.67 GiB (~10 свободно), диск 90 GiB свободно, 6 vCPU AMD EPYC
- Firewall: inactive (включить `ufw allow 22,80,443` на финале)
- Существующие контейнеры (не трогать): `main_nginx`, `linkbetter_bot`, `flowershop_*`
- Существующие домены на main_nginx: `flowers.muzaffarbahodir.uz`, `tilloreferal.muzaffarbahodir.uz`

### Cloudflare
- Зона `muzaffarbahodir.uz` уже на CF
- DNS A-записи (3) + R2 CNAME (1) — добавлены, серое облако кроме cdn (orange)
- SSL/TLS: Full (strict)
- Origin Cert wildcard `*.linguolab.muzaffarbahodir.uz` (15 лет, RSA 2048) — сохранён локально
- R2 bucket `linguolab-files` (WEUR), CORS настроен
- R2 API token `linguolab-r2` (Object R/W на linguolab-files) — сохранён локально

### Telegram
- Bot username: `@linguolab_bot`
- Bot token — будет повторно сгенерирован через `/revoke` после Этапа 0.5

### Платежи
- Payme/Click/Uzumbank — пока sandbox/заглушки, провайдеры в БД `is_enabled=false` для prod
- Soliq — sandbox

### Email
- Skip. Уведомления через TG.

---

## 15. БЛИЖАЙШИЕ ШАГИ (после подтверждения этого файла)

1. Revoke TG-токен у `@BotFather` → новый токен сохранить локально
2. Создать GitHub repo `artsoftmuzaffarkhon/linguolab` (public)
3. Локально: `pnpm init` + Turborepo + три app'а скелет
4. Этап 0.5 — серверная инфраструктура + первый CI/CD деплой пустой заглушки
5. Этап 1 — скелет приложений + первый коммит с Husky/commitlint

---

**Версия:** v5 (PLAN_FINAL)
**Дата:** 2026-05-10
**Источник правды:** этот файл. Все будущие изменения — через PR с обновлением `PLAN_FINAL.md`.
