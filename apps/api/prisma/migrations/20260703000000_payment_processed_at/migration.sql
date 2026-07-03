-- A4: идемпотентность обработки оплаты. processed_at = доменные side-effects
-- (продление доступа + кэшбэк) применены ровно один раз (compare-and-set).
ALTER TABLE "payments" ADD COLUMN "processed_at" TIMESTAMP(3);
