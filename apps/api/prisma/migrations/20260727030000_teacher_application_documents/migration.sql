-- Документы кандидата и созвон перед решением.
--
-- Набор документов зависит от формата работы: онлайн-преподаватель в офис не
-- приедет и присылает всё цифрой, очному часть бумаг проще привезти лично.
-- Решение принимается после назначенного созвона — либо раньше, отказом с
-- указанием причины.

CREATE TYPE "TeacherWorkFormat" AS ENUM ('ONLINE', 'OFFLINE');

-- INTERVIEW — документы приняты, назначен созвон.
ALTER TYPE "TeacherApplicationStatus" ADD VALUE IF NOT EXISTS 'INTERVIEW' BEFORE 'APPROVED';

ALTER TABLE "teacher_applications"
  ADD COLUMN "work_format"  "TeacherWorkFormat" NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN "documents"    JSONB,
  ADD COLUMN "interview_at" TIMESTAMP(3),
  ADD COLUMN "reviewed_by"  TEXT;
