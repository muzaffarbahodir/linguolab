-- Курс (направление) = Language + инфо: продолжительность, что входит, требования.
-- Учитель предлагает то же в заявке (class_requests), переносится в Language на апруве.
-- Таблицы: "Language" (без @@map), "class_requests" (@@map).

ALTER TABLE "Language" ADD COLUMN IF NOT EXISTS "duration_label" TEXT;
ALTER TABLE "Language" ADD COLUMN IF NOT EXISTS "includes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Language" ADD COLUMN IF NOT EXISTS "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "class_requests" ADD COLUMN IF NOT EXISTS "course_duration" TEXT;
ALTER TABLE "class_requests" ADD COLUMN IF NOT EXISTS "course_includes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "class_requests" ADD COLUMN IF NOT EXISTS "course_requirements" TEXT[] DEFAULT ARRAY[]::TEXT[];
