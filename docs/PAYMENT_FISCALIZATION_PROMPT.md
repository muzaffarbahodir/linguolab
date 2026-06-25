# Промпт: Интеграция платёжных систем УЗ + Фискализация (Soliq)

> Добавь к существующему плану LinguoLab новый этап — полную замену платёжного модуля.
> Stripe/YooKassa убираются. Вместо них — узбекские платёжные шлюзы + обязательная фискализация через Soliq.uz.

---

## КОНТЕКСТ ИЗ ТЕКУЩЕГО ПЛАНА

В плане уже существует:

- **Этап 11** — `modules/payments/*`, `modules/subscriptions/*`
- Таблица `payments` — `id, user_id, subscription_id, amount_cents, currency, provider, provider_id, status, created_at`
- Таблица `subscriptions` — `id, user_id, plan, started_at, expires_at, status`
- Абстракция `PaymentProvider` (упомянута в Риске 12)
- Эндпоинты: `POST /payments/checkout`, `POST /payments/webhook`, `GET /payments/history`

Всё это СОХРАНЯЕТСЯ. Тебе нужно расширить и заменить реализацию.

---

## ЗАДАЧА

Полностью описать архитектуру и план реализации следующего:

### 1. Три платёжных провайдера (Узбекистан)

**A. Payme (Payme Business)**

- Docs: https://developer.payme.uz
- Протокол: JSON-RPC 2.0 (методы: `CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`, `CheckTransaction`, `GetStatement`)
- Виджет: iframe / redirect
- Webhook: входящий JSON-RPC от Payme на наш сервер
- Валюта: UZS (тийины — умножай на 100)
- Аутентификация: Basic Auth (`Paycom:<SECRET_KEY>`)

**B. Click (Click Up)**

- Docs: https://docs.click.uz
- Протокол: REST (два шага: Prepare + Complete)
- Эндпоинты на нашей стороне: `POST /payments/click/prepare`, `POST /payments/click/complete`
- Webhook: Click шлёт запросы нам (Prepare → Complete)
- Валюта: UZS (тийины)
- Аутентификация: HMAC-SHA1 подпись

**C. Uzumbank (Uzum Bank)**

- Протокол: REST API (если нет публичной доки — заглушка с интерфейсом, совместимым с остальными)
- Эндпоинты: checkout → redirect → callback
- Webhook: callback URL

---

### 2. Фискализация через Soliq.uz (ОФД)

**Контекст:**
В Узбекистане с 2021 года онлайн-торговля обязана фискализировать каждый платёж через ОФД (оператор фискальных данных). Soliq.uz — государственная система налоговой.

**Что нужно сделать:**

**A. Интеграция с API Soliq (ОФД)**

- API: `https://ofd.soliq.uz` (sandbox: `https://ofd-test.soliq.uz`)
- Авторизация: Bearer токен (получается через `POST /auth/login` с TIN + password)
- Основной метод: `POST /api/fiscal/receipt` — отправка чека
- Структура чека (Receipt):
  - `merchant_id` — ИНН организации
  - `terminal_id` — ID кассового терминала
  - `receipt_type` — SALE / REFUND
  - `items[]` — список позиций (name, quantity, price, vat_percent, discount)
  - `payment_type` — CARD / CASH / OTHER
  - `total_amount` — сумма в тийинах
  - `time` — время транзакции (ISO 8601)
  - `extra` — внешний ID (наш `payment_id`)
- Ответ: `fiscal_sign` (QR-код подпись), `fiscal_number`, `receipt_url`

**B. VAT (НДС)**

- Ставка НДС Узбекистан: 12%
- Поле `vat_percent: 12` в каждой позиции чека
- В БД хранить: `vat_amount_cents`, `vat_rate`

**C. Чек покупателю**

- Отправить ссылку `receipt_url` от Soliq через:
  - Push-уведомление (Expo)
  - Telegram-сообщение
  - Email
- Отобразить в `GET /payments/history` (поле `fiscal_receipt_url`)

---

## ЧТО НУЖНО СПЛАНИРОВАТЬ

Дай детальный план по следующей структуре:

---

### БЛОК 1 — Изменения в схеме БД (Prisma)

Укажи точно:

- Какие поля добавить в таблицу `payments`
- Какие новые таблицы создать (например: `fiscal_receipts`, `payment_providers_config`)
- Индексы
- Enum'ы (PaymentProvider, FiscalStatus и т.д.)
- Миграции Prisma (имена файлов)

---

### БЛОК 2 — Архитектура модуля `payments` (NestJS)

Опиши структуру файлов:

```
api/src/modules/payments/
api/src/modules/fiscal/
```

Для каждого файла — название + за что отвечает.

Включи:

- Абстрактный класс / интерфейс `IPaymentProvider`
- Реализации: `PaymeProvider`, `ClickProvider`, `UzumbankProvider`
- `PaymentProviderFactory` — выбор провайдера по enum
- `FiscalService` — отправка чека в Soliq
- `FiscalRetryService` — повторные попытки если Soliq недоступен (BullMQ)

---

### БЛОК 3 — API Endpoints

Перечисли все новые и изменённые эндпоинты:

| Метод | Путь                        | Провайдер | Описание                     |
| ----- | --------------------------- | --------- | ---------------------------- |
| POST  | /payments/checkout          | все       | Инициировать оплату          |
| POST  | /payments/payme/webhook     | Payme     | JSON-RPC от Payme            |
| POST  | /payments/click/prepare     | Click     | Шаг 1                        |
| POST  | /payments/click/complete    | Click     | Шаг 2                        |
| POST  | /payments/uzumbank/callback | Uzumbank  | Callback                     |
| GET   | /payments/history           | —         | История + fiscal_receipt_url |
| GET   | /fiscal/receipt/:id         | —         | Статус фискализации          |

Для каждого webhook-эндпоинта укажи:

- Метод верификации подписи
- Порядок обработки (idempotency)
- Что делать если Soliq упал в момент успешной оплаты

---

### БЛОК 4 — Флоу "Оплата → Фискализация" (step by step)

Опиши полный жизненный цикл одной транзакции:

```
Студент нажал "Оплатить" → ... → Чек в Telegram
```

Каждый шаг с указанием:

- Кто инициирует (frontend, backend, webhook)
- Какой сервис/метод вызывается
- Что записывается в БД
- Что может пойти не так + как обрабатывается

---

### БЛОК 5 — Изменения в существующем Этапе 11

Покажи diff: что убираем (Stripe/YooKassa), что добавляем, как меняется порядок подэтапов.

Новый порядок подэтапов Этапа 11:

1. ...
2. ...
3. ...

---

### БЛОК 6 — Новый Этап 11.5 — Фискализация (отдельный этап)

Так как фискализация — отдельная юридическая обязанность, выдели её в подэтап:

- Что делается
- Какие файлы создаются
- Результат: "каждый успешный платёж фискализирован, чек отправлен юзеру"
- Как тестировать (sandbox Soliq)

---

### БЛОК 7 — Риски (дополнить существующий список)

Добавь к существующим 14 рискам новые:

1. **Soliq API недоступен** в момент оплаты → что делать
2. **Дублирование чека** (webhook пришёл дважды) → idempotency
3. **Неверный ИНН / terminal_id** → ошибка авторизации Soliq
4. **Payme заморозил транзакцию** (CheckTransaction возвращает WAITING) → таймаут
5. **Click Prepare прошёл, Complete не пришёл** → orphan транзакция
6. **НДС ставка изменилась** (государство меняет %) → как обновить без деплоя
7. **Валюта** — всё в тийинах (UZS × 100), не перепутать с сомами

---

### БЛОК 8 — ENV переменные

Перечисли все новые переменные для `.env.example`:

```
# Payme
PAYME_MERCHANT_ID=
PAYME_SECRET_KEY=
PAYME_TEST_SECRET_KEY=
PAYME_ENDPOINT=https://checkout.paycom.uz

# Click
CLICK_SERVICE_ID=
CLICK_MERCHANT_ID=
CLICK_SECRET_KEY=
CLICK_ENDPOINT=https://my.click.uz/services/pay

# Uzumbank
UZUMBANK_MERCHANT_ID=
UZUMBANK_SECRET_KEY=
UZUMBANK_ENDPOINT=

# Soliq (ОФД)
SOLIQ_API_URL=https://ofd.soliq.uz
SOLIQ_SANDBOX_URL=https://ofd-test.soliq.uz
SOLIQ_TIN=
SOLIQ_PASSWORD=
SOLIQ_TERMINAL_ID=
SOLIQ_MERCHANT_ID=
SOLIQ_VAT_RATE=12
```

---

### БЛОК 9 — Тесты

Укажи какие тесты написать:

- Unit тесты для каждого провайдера (mock HTTP)
- Unit тесты для `FiscalService` (mock Soliq API)
- e2e тест: `POST /payments/checkout (payme)` → mock webhook → проверить статус payment + fiscal
- Тест idempotency: дважды один и тот же webhook → одна запись в БД

---

## ПРАВИЛА ОТВЕТА

- Только план, никакого кода пока
- По каждому блоку — чёткие пронумерованные списки
- Названия файлов указывай точно (`modules/fiscal/fiscal.service.ts`)
- Для каждого нового поля БД — тип данных (`String`, `Int`, `DateTime`, `Json`, `Boolean`)
- Если что-то неясно по API Soliq или Uzumbank — явно пометь `[УТОЧНИТЬ]` и предложи заглушку
- В конце — краткое резюме изменений на 5 строк

Жди моего подтверждения плана перед тем как писать код.
