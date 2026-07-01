-- Performance indexes (idempotent, safe on live DB).
-- Имена совпадают с конвенцией Prisma, чтобы не было drift.

-- payments: PAID + paid_at — товарооборот, последние оплаты, revenue-share HR,
-- месячная аналитика. Раньше индекса на paid_at не было → seq scan по платежам.
CREATE INDEX IF NOT EXISTS "payments_status_paid_at_idx" ON "payments" ("status", "paid_at");

-- lessons: COMPLETED-уроки за период — расчёт зарплаты (PER_LESSON),
-- аналитика и статистика по проведённым занятиям.
CREATE INDEX IF NOT EXISTS "lessons_status_scheduled_at_idx" ON "lessons" ("status", "scheduled_at");
