-- Пробные уроки: тип (онлайн/очный) + привязка к классу/платежу.
-- Zoom-ссылка на класс + заявку учителя.
-- Имена таблиц: "Class", "TrialLessonRequest" (без @@map); "class_requests", "payments" (@@map).

-- 1. Enum TrialType (guard на повтор)
DO $$ BEGIN
  CREATE TYPE "TrialType" AS ENUM ('ONLINE', 'OFFLINE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Class.meeting_url
ALTER TABLE "Class" ADD COLUMN IF NOT EXISTS "meeting_url" TEXT;

-- 3. ClassRequest.meeting_url
ALTER TABLE "class_requests" ADD COLUMN IF NOT EXISTS "meeting_url" TEXT;

-- 4. TrialLessonRequest: type / class_id / payment_id
ALTER TABLE "TrialLessonRequest" ADD COLUMN IF NOT EXISTS "type" "TrialType" NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "TrialLessonRequest" ADD COLUMN IF NOT EXISTS "class_id" TEXT;
ALTER TABLE "TrialLessonRequest" ADD COLUMN IF NOT EXISTS "payment_id" TEXT;

-- 5. Индексы
CREATE UNIQUE INDEX IF NOT EXISTS "TrialLessonRequest_payment_id_key" ON "TrialLessonRequest"("payment_id");
CREATE INDEX IF NOT EXISTS "TrialLessonRequest_class_id_idx" ON "TrialLessonRequest"("class_id");

-- 6. Внешние ключи (guard через DO-блок)
DO $$ BEGIN
  ALTER TABLE "TrialLessonRequest"
    ADD CONSTRAINT "TrialLessonRequest_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TrialLessonRequest"
    ADD CONSTRAINT "TrialLessonRequest_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
