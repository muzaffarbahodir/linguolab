-- Payment: поля возврата (дата + причина). Таблица называется "payments" (@@map).
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refund_reason" TEXT;
