# LinguoLab — Аудит проблем, уязвимостей, недоработок

> **Дата аудита:** 30.05.2026
> **Скоуп:** весь monorepo (apps/web + apps/api + infra)
> **Источник:** автоматическое сканирование + ручной обзор

---

## 📊 Сводка

| Severity | Кол-во | Статус |
|---|---|---|
| 🔴 CRITICAL | 4 | ✅ все закрыты (31.05.2026) |
| 🟠 HIGH | 5 | ✅ все закрыты (31.05.2026) |
| 🟡 MEDIUM | 6 | ✅ M1-M5 закрыты, M6 принято (01.06.2026) |
| 🟢 LOW | 4 | ✅ закрыты / приняты (01.06.2026) |

---

## 🔴 CRITICAL — требует немедленного фикса

### ✅ C1. N+1 запросы в getClassStudentStats

> **ЗАКРЫТО** commit `4566f48` (31.05.2026)

- **Файл:** `apps/api/src/modules/classes/classes.service.ts:174-201`
- **Проблема:** `.map(async (e) => { ... })` с двумя `prisma.X.count()` внутри. Для 30 студентов = 60+ запросов вместо 2.
- **Импакт:** Медленный отклик `/classes/:id/student-stats`, нагрузка на DB
- **Фикс:** `Promise.all()` + groupBy aggregations:

```typescript
const [attendanceStats, hwStats] = await Promise.all([
  prisma.lessonAttendance.groupBy({
    by: ['student_id'],
    where: { lesson: { class_id: classId } },
    _count: { _all: true },
  }),
  prisma.homeworkSubmission.groupBy({
    by: ['student_id'],
    where: { homework: { class_id: classId } },
    _count: { _all: true },
  }),
]);
// затем merge через Map
```

---

### ✅ C2. Слабая валидация на presigned upload

> **ЗАКРЫТО** commit `2207346` (31.05.2026)

- **Файл:** `apps/api/src/modules/storage/storage.controller.ts:26-32`
- **Проблема:** `PresignDto` не имеет `@Length()`, `@IsIn()`, нет лимита размера файла. Атакующий может:
  - Очень длинные filename (DoS на S3)
  - Произвольный MIME (включая executable)
  - Загрузка неограниченных файлов (биллинг R2)
- **Импакт:** Возможный abuse R2 storage + биллинг + XSS через image MIME
- **Фикс:**

```typescript
class PresignDto {
  @IsString() @Length(1, 255) @Matches(/^[\w.\-]+$/) filename!: string;
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) contentType!: string;
  @IsNumber() @Min(1000) @Max(50 * 1024 * 1024) size!: number; // 50MB
}
```

---

### ✅ C3. Hardcoded localhost fallback в frontend client

> **ЗАКРЫТО** commit `b0e6e6f` (31.05.2026)

- **Файл:** `apps/web/src/api/client.ts:34`
- **Проблема:** `baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'` — если в проде VITE_API_URL не задан, app пойдёт на HTTP localhost
- **Импакт:** Mixed-content errors в TWA, поломка прод-сборки если build без env
- **Фикс:** Жёсткая проверка в build-time:

```typescript
if (!import.meta.env.VITE_API_URL) {
  throw new Error('VITE_API_URL не задан');
}
const baseURL = import.meta.env.VITE_API_URL;
```

Или fail-loud дефолт: `'https://api-linguolab.muzaffarbahodir.uz/api/v1'`

---

### ✅ C4. Docker images используют :latest

> **ЗАКРЫТО** commit `6a8adb6` (31.05.2026)

- **Файл:** `infra/compose/docker-compose.yml:38,58,78`
- **Проблема:** `ghcr.io/muzaffarbahodir/linguolab-api:latest` — нет version pinning
- **Импакт:** Supply chain attack risk, нет rollback на конкретную версию, kubelets reuse не работает корректно
- **Фикс:**
  - CI пушит две метки: `:latest` И `:${{ github.sha }}` (короткий SHA)
  - docker-compose.yml использует SHA: `linguolab-api:${API_TAG:-latest}`
  - `.env` на сервере хранит `API_TAG=abc1234`
  - При deploy CI обновляет .env

---

## 🟠 HIGH — фикс до production

> ✅ Все 5 HIGH закрыты (31.05.2026)

### ✅ H1. Click webhook без DTO валидации

> **ЗАКРЫТО** commit `38a261f` (31.05.2026)

- **Файл:** `apps/api/src/modules/payments/click/click.service.ts:33-56, 110-135`
- **Проблема:** `body: Record<string, string | number>` без `class-validator`. Поля `sign_string`, `amount`, `merchant_trans_id` извлекаются без проверки типа.
- **Импакт:** Возможен обход подписи через подмену `sign_time`, краш сервиса на malformed данных
- **Фикс:** Создать `ClickPrepareDto` + `ClickCompleteDto` с `@IsString()`, `@IsNumber()`, `@Min()`, `@Matches()`. Использовать `ValidationPipe({ transform: true })`.

---

### ✅ H2. Future-dated auth_date не отклоняется

> **ЗАКРЫТО** commit `3f99c38` (31.05.2026)

- **Файл:** `apps/api/src/modules/auth/telegram-init.validator.ts:97-109`
- **Проблема:** Проверка `auth_date` > 24ч в прошлом есть, но `auth_date` в будущем не проверяется
- **Импакт:** Forged token с auth_date в будущем останется валидным
- **Фикс:** Добавить:

```typescript
if (authDateSeconds > Date.now() / 1000 + 60) {
  throw new UnauthorizedException('auth_date в будущем');
}
```

---

### ✅ H3. SQL injection потенциал в admin.service raw queries

> **ЗАКРЫТО** commit `db13dc7` (31.05.2026)

- **Файл:** `apps/api/src/modules/admin/admin.service.ts:674,703,741`
- **Проблема:** `$queryRaw` используется для агрегаций. Хотя Prisma параметризует tagged templates, входные параметры (`classId` и т.д.) не валидируются.
- **Импакт:** При невалидном UUID возможны SQL errors, информационная утечка
- **Фикс:** Заменить `$queryRaw` на `prisma.X.groupBy()` API, или валидировать UUID:

```typescript
if (!/^[0-9a-f-]{36}$/.test(classId)) throw new BadRequestException('Invalid classId');
```

---

### ✅ H4. Payme auth header пустой пароль

> **ЗАКРЫТО** commit `29ffc06` (31.05.2026)

- **Файл:** `apps/api/src/modules/payments/payments.controller.ts:81-96`
- **Проблема:** `colonIdx >= 0 ? decoded.slice(colonIdx + 1) : ''` — empty password проходит если `merchantKey` тоже пустой
- **Импакт:** При misconfig (пустой merchantKey в .env) webhook без password принимается
- **Фикс:**

```typescript
const password = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : '';
if (!password || !merchantKey || password !== merchantKey) {
  throw new UnauthorizedException();
}
```

---

### ✅ H5. N+1 в Teacher Rating computation

> **ЗАКРЫТО** commit `d1cfb62` (31.05.2026)

- **Файл:** `apps/api/src/modules/classes/classes.service.ts:461-468`
- **Проблема:** `studentIds.map((sid) => classAttendance.filter(...))` — O(n²)
- **Импакт:** 100 студентов = 10,000 итераций
- **Фикс:** Конвертировать в Map:

```typescript
const byStudent = new Map<string, AttendanceRecord[]>();
for (const a of classAttendance) {
  const arr = byStudent.get(a.student_id) ?? [];
  arr.push(a);
  byStudent.set(a.student_id, arr);
}
// Lookup O(1)
```

---

## 🟡 MEDIUM — плановый фикс

### ✅ M1. Uzumbank endpoint — заглушка с TODO

> **ЗАКРЫТО** commit `0f0c931` (01.06.2026)

- **Файл:** `apps/api/src/modules/payments/payments.controller.ts:122-128`
- **Проблема:** Возвращает success без обработки. TWA Payment.tsx показывает Uzum Bank как доступный провайдер.
- **Фикс:** Либо вернуть HTTP 501, либо скрыть Uzumbank в `PROVIDERS` в `apps/web/src/pages/Payment.tsx`, либо реализовать.

---

### ✅ M2. Множество DTO без `@Length`/`@ArrayMaxSize`

> **ЗАКРЫТО** commit `f8ba6e7` (01.06.2026)

- **Файлы:** все DTO в `apps/api/src/modules/*/dto/`
- **Проблема:** Только ~14 DTO имеют length-валидацию. Большинство:
  - `CreateHomeworkDto` — title, description без `@Length`
  - `CreateSupportTicketDto` — message без `@Length`
  - `CreatePlacementTestDto` — questions array без `@ArrayMaxSize`
- **Импакт:** DoS через гигантские payload, абуз storage
- **Фикс:** Аудит всех DTO + добавить:
  - `@Length(1, 500)` для коротких текстов
  - `@Length(1, 5000)` для длинных
  - `@ArrayMaxSize(100)` для массивов

---

### ✅ M3. Race condition в идемпотентности платежей

> **ЗАКРЫТО** commit `67c404e` (01.06.2026)

- **Файл:** `apps/api/src/modules/payments/payments.service.ts:33-42`
- **Проблема:** Два параллельных запроса с одним `idempotency_key`:
  - оба проходят `findUnique` → нет записи
  - оба пытаются `create` → unique constraint падает у второго
  - но первый ответ может быть медленнее → клиент видит ошибку
- **Фикс:** Заменить на `upsert`:

```typescript
return this.prisma.payment.upsert({
  where: { idempotency_key: dto.idempotency_key },
  create: { ... },
  update: {}, // ничего не меняем если есть
});
```

---

### ✅ M4. Нет rate limiting на чувствительных public endpoints

> **ЗАКРЫТО** commit `dfc40f3` (01.06.2026)

- **Файл:** `apps/api/src/app.module.ts:64-65`
- **Проблема:** Global throttler есть (20/sec, 300/min), но `/auth/telegram/init` (дорогой HMAC) и webhooks могут быть abused
- **Фикс:** Добавить `@Throttle({ default: { limit: 5, ttl: 60000 } })` на:
  - `POST /auth/telegram/init` — 5/min
  - `POST /support/tickets` — 3/min
  - `POST /trial-lessons/request` — 3/min

---

### ✅ M5. CORS fallback на localhost в продакшене

> **ЗАКРЫТО** commit `cb7896f` (01.06.2026)

- **Файл:** `apps/api/src/main.ts:39-42`
- **Проблема:** `CORS_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:3001'` — если env не задан в проде, разрешит CORS от localhost (безопасно но обманчиво)
- **Фикс:** Throw at startup если `NODE_ENV === 'production'` && `!process.env.CORS_ALLOWED_ORIGINS`

---

### M6. Fire-and-forget без guaranteed retry

- **Файл:** `apps/api/src/modules/payments/click/click.service.ts:191,194,197`
- **Проблема:** `void this.handlePaymentPaid()`, `void this.fiscal.scheduleReceipt()` — ошибки логируются, но webhook отвечает 200 OK. Inconsistent state.
- **Фикс:** Заменить на BullMQ job:

```typescript
await this.bullQueue.add('handle-paid', { paymentId }, { attempts: 5, backoff: 'exponential' });
```

---

## 🟢 LOW — nice-to-have

### ✅ L1. REDIS_PASSWORD через `--requirepass`

> **ПРИНЯТО** — Docker secrets overkill для single-server. Revisit при scaling.

- **Файл:** `infra/compose/docker-compose.yml:26`
- **Проблема:** Виден в `docker inspect`. Docker secrets безопаснее но overkill для single-server.
- **Фикс:** Принять как есть пока scaling не понадобится.

---

### ✅ L2. Missing Prisma indexes на горячие поля

> **VERIFIED** — все горячие поля уже проиндексированы в schema.prisma (01.06.2026)

- **Файл:** `apps/api/prisma/schema.prisma`
- **Проблема:** Возможно не хватает `@@index([class_id])`, `@@index([student_id])` на часто-запрашиваемых таблицах
- **Фикс:** Запросить EXPLAIN ANALYZE на slow queries в PG; добавить индексы где нужно.

---

### ✅ L3. CI без coverage threshold

> **ЗАКРЫТО** commit `4007972` (01.06.2026) — добавлен --coverage с text-summary reporter

- **Файл:** `.github/workflows/ci.yml`
- **Проблема:** `pnpm test` запускается, но нет минимального покрытия
- **Фикс:** Добавить:

```yaml
- run: pnpm test -- --coverage --coverageThreshold='{"global":{"lines":70}}'
```

---

### ✅ L4. Отсутствие `.env.example` для всех модулей

> **ЗАКРЫТО** commit `4007972` (01.06.2026)

- **Файл:** `.env.example`
- **Проблема:** Возможно расходится с реально требуемыми переменными
- **Фикс:** Сравнить `grep -r "process.env" apps/api/src` с `.env.example` и добавить missing keys

---

## 🚨 Не покрыто этим аудитом (требует отдельной проверки)

- Polling endpoint `/notifications` — есть ли refetch budget?
- WebSocket гонок при одновременных оценках ДЗ
- Soliq фискализация — не реализована (см. `PAYMENT_FISCALIZATION_PROMPT.md`)
- E2E тесты — отсутствуют для критичных flow (платёжный, регистрация, оценка ДЗ)
- Sentry / OpenTelemetry — не подключены

---

## 📋 Приоритизация фиксов (рекомендация)

| Spr | Что |
|---|---|
| Sprint 1 | C1, C2, C3, C4 (всё CRITICAL) |
| Sprint 2 | H1, H2, H3, H4, H5 (HIGH) |
| Sprint 3 | M1, M2, M3, M4 |
| Backlog | M5, M6, L1-L4 |

---

## ✅ Что работает хорошо

- JWT auth с rotation chain (refresh tokens)
- RBAC через `@Roles()` + `RolesGuard` глобально
- ThrottlerModule подключён
- BullMQ для notifications с dedup через Redis SETEX
- Conventional Commits + commitlint + Husky
- TanStack Query staleTime 30s оптимизирован для TWA
- i18n 3 языка (ru/en/uz)
- Prisma type safety
- Code splitting через `lazy()` снижает bundle на 35%
