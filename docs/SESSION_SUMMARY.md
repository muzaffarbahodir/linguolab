# LinguoLab — Сводка работ сессии

## 📋 Контекст

Большая многосессионная работа над LinguoLab TWA (Telegram Mini App):

- **Frontend:** React + Vite + TypeScript, TanStack Query, Tailwind, i18next
- **Backend:** NestJS + Prisma + PostgreSQL + Redis (BullMQ)
- **Server:** `79.143.176.220`, Docker, nginx
- **CI/CD:** GitHub Actions автодеплой с `main` ветки
- **Деплой Web:** scp статики в `/opt/linguolab/web/dist/` + chmod 755/644
- **Деплой API:** GHCR Docker image → docker-compose pull

---

## ✅ Сделано (всё закоммичено и в `main`)

### 1. BottomSheet UI fix

- `createPortal(document.body)` — обход stacking context от `glass-fade-in`
- Свайп вниз > 80px → закрыть, spring-back если меньше
- Удалён × close button, остался handle bar
- Zustand `useUIStore.bottomSheetOpen` → `App.tsx` скрывает BottomNav

### 2. Courses + Payment

- `Courses.tsx`: секция "Мои заявки на пробный урок" с цветными badge статусов
- `Payment.tsx`: инвойс с активными enrollments + кнопка "💳 Оплатить"

### 3. Админ панель (9 новых TWA-страниц)

| Страница             | Route                     | Функционал                          |
| -------------------- | ------------------------- | ----------------------------------- |
| AdminTeachers        | `/admin/teachers`         | CRUD + бейджи (preset icons)        |
| AdminClasses         | `/admin/classes`          | CRUD + расписание + архивация       |
| AdminAnalytics       | `/admin/analytics`        | SVG charts: revenue/students/funnel |
| AdminEnrollments     | `/admin/enrollments`      | PENDING→ACTIVE / DROPPED / restore  |
| AdminCertificates    | `/admin/certificates`     | По классу + глобальный поиск        |
| AdminPaymentSettings | `/admin/payment-settings` | Toggle PAYME/CLICK/UZUMBANK         |
| AdminReferrals       | `/admin/referrals`        | Стата + топ-10 рефереров            |
| TeacherStats         | `/teacher/stats`          | 4 карточки + per-class grid         |

### 4. Backend

- `GET /referrals/admin/stats` (MANAGER+) — реферальная аналитика
- `useSetClassSchedule`, `useAllEnrollments`, `useUpdateEnrollmentStatus`
- `useAdminTeachers/Classes` + CRUD hooks
- `usePaymentProviders`, `useReferralStats`
- `useAwardBadge`, `useRemoveBadge`, `useIssueCertificate`

### 5. Code Splitting

- `lazy()` для всех non-critical pages
- Bundle: **657kb → 422kb** (-35%)
- Eager: HomePage, ProfilePage, NotInTelegramPage, Onboarding
- `<Suspense fallback={<PageLoader />}>` обёртка

### 6. i18n полный (3 языка ru/en/uz)

- ~700 строк в каждом translation.json
- Секции: support, attendance, notifications, certificates, placement, teacher, parent
- Полный admin.\*: home, users, students, teachers, classes, analytics, enrollments, certificates, trials, support, transfers, finance, broadcast, audit, payment_settings, referrals
- Применено: Support, Attendance, AdminReferrals, AdminEnrollments, TeacherStats, AdminPaymentSettings, AdminAnalytics, AdminClasses, AdminTeachers

### 7. ✅ Backend Telegram уведомления (ЗАВЕРШЕНО)

**notification.types.ts** — 6 новых типов + DEDUP_TTL:

- `ENROLLMENT_CONFIRMED`, `ENROLLMENT_DROPPED`
- `TRIAL_CONFIRMED`, `TRIAL_CANCELLED`
- `SUPPORT_TICKET_UPDATED`
- `CERTIFICATE_ISSUED`

**notifications.service.ts** — 6 новых методов через BullMQ:

- `scheduleEnrollmentConfirmed(userId, classTitle, enrollmentId)`
- `scheduleEnrollmentDropped(userId, classTitle, enrollmentId)`
- `scheduleTrialConfirmed(userId, languageName, trialId)`
- `scheduleTrialCancelled(userId, languageName, trialId)`
- `scheduleSupportTicketUpdated(userId, subject, status, ticketId)`
- `scheduleCertificateIssued(userId, classTitle, certId)`

**Inject + вызовы в сервисах:**

- ✅ `enrollments.service.ts` — `updateStatus()` шлёт notify
- ✅ `support.service.ts` — `updateStatus()` шлёт notify
- ✅ `trial-lessons.service.ts` — `updateStatus()` шлёт notify
- ✅ `certificates.service.ts` — `issue()` шлёт notify

**Регистрация модулей (выполнено):**

- ✅ `enrollments.module.ts` — `imports: [TeachersModule, NotificationsModule]`
- ✅ `support.module.ts` — `imports: [NotificationsModule]`
- ✅ `trial-lessons.module.ts` — `imports: [NotificationsModule]`
- ✅ `certificates.module.ts` — `imports: [StorageModule, NotificationsModule]`

Commit: `c02774d feat: Telegram notifications on status changes`

### 8. ✅ Экспорт CSV (ЗАВЕРШЕНО)

- `AdminStudents.tsx` — кнопка 📥 CSV (ADMIN+) → axios `responseType: 'blob'` → `<a download>`
- `AdminFinance.tsx` — кнопка 📥 CSV для платежей
- Endpoint backend уже был: `GET /admin/students/export`, `GET /admin/payments/export`

Commit: `4b90dc6 feat: CSV export buttons, student search in certificates`

### 9. ✅ Поиск студентов в сертификатах (ЗАВЕРШЕНО)

- `AdminCertificates.tsx` — два режима через табы
- Режим «По классу»: фильтр inline по имени
- Режим «Поиск»: `useAdminStudents(search)` → `FoundStudentRow` → expand → выбор класса → выдача

---

## 🔧 Технические детали

### Git workflow

- Работа **напрямую на `main`** (нет feature branches)
- После каждого изменения: `git add` + commit + `git push origin main`
- CI/CD автодеплоит Web и API параллельно

### Деплой Web вручную

```powershell
ssh -i $env:USERPROFILE\.ssh\linguolab_deploy root@79.143.176.220 "rm -rf /opt/linguolab/web/dist/assets"
scp -i $env:USERPROFILE\.ssh\linguolab_deploy -r dist/assets root@79.143.176.220:/opt/linguolab/web/dist/
scp -i $env:USERPROFILE\.ssh\linguolab_deploy dist/index.html root@79.143.176.220:/opt/linguolab/web/dist/index.html
ssh -i $env:USERPROFILE\.ssh\linguolab_deploy root@79.143.176.220 "chmod 755 /opt/linguolab/web/dist/assets && chmod 644 /opt/linguolab/web/dist/assets/*"
```

**⚠️ ВАЖНО:** scp создаёт `assets/` с правами `0700` (root only) → nginx 403. Всегда chmod после!

### URL

- TWA: `https://app-linguolab.muzaffarbahodir.uz`
- API: `https://api-linguolab.muzaffarbahodir.uz`
- Health: `GET /health`
- API prefix: `/api/v1/*`

### Структура проекта

```
linguolab/
├── apps/
│   ├── web/      # React TWA
│   ├── api/      # NestJS backend
│   └── admin/    # Старая Next.js admin (deprecated)
└── compose/      # docker-compose.yml на сервере
```

---

## 📌 Что осталось (мелочи)

### 🟡 i18n остаточные страницы

Применить `t()` в:

- `TeacherHome.tsx`, `TeacherSubmissions.tsx`, `TeacherClass.tsx`
- `ParentChild.tsx` (много хардкода)
- `Schedule.tsx`, `Courses.tsx`, `Home.TrialLessonsSection`
- `AdminHome.tsx` (QUICK_LINKS labels)
- `AdminStudents.tsx`, `AdminFinance.tsx`

### 🟢 Большие задачи (отдельные сессии)

- Этап 11.5 — Фискализация Soliq
- Этап 14 — Тесты (Unit / Integration / e2e Playwright)
- Этап 13.5 — analytics_events partitioned + materialized views
- Weekly PDF-отчёт SUPER_ADMIN
- Sentry + OpenTelemetry

---

## 🗂 Состояние ветки `main` (на момент обновления)

Последние коммиты:

```
a38f070 feat(i18n): translate AdminAnalytics, AdminClasses, AdminTeachers via t()
4b90dc6 feat: CSV export buttons, student search in certificates, i18n for more pages
c02774d feat: Telegram notifications on status changes
c7138fa feat: i18n 3 languages (ru/en/uz) for all pages and roles
930183e feat: A8 referral analytics + code splitting + lazy loading
d735651 feat: payment settings, teacher badges (A6, A7)
4ba5b28 feat: AdminCertificates, TeacherStats pages
e4bff8a feat: class schedule UI, enrollments management page
f39611d feat: AdminTeachers, AdminClasses, AdminAnalytics pages + API hooks
30b2967 feat: trial requests in Courses page, invoice in Payment page
226ccba feat: BottomSheet via portal, hide BottomNav when sheet open
```

**Local & Remote main:** в синхроне. Все изменения запушены.
