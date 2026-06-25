-- Migration: lessons + lesson_attendances tables
-- Этап: исправление пропущенных (#7)

CREATE TYPE "LessonStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

CREATE TABLE "lessons" (
  "id"           TEXT NOT NULL,
  "class_id"     TEXT NOT NULL,
  "title"        TEXT,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "duration_min" INTEGER NOT NULL DEFAULT 60,
  "status"       "LessonStatus" NOT NULL DEFAULT 'SCHEDULED',
  "notes"        TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lessons_class_id_scheduled_at_idx" ON "lessons"("class_id", "scheduled_at");
CREATE INDEX "lessons_scheduled_at_idx"           ON "lessons"("scheduled_at");

ALTER TABLE "lessons"
  ADD CONSTRAINT "lessons_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "Class"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "lesson_attendances" (
  "id"         TEXT NOT NULL,
  "lesson_id"  TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "status"     "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
  "note"       TEXT,

  CONSTRAINT "lesson_attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lesson_attendances_lesson_id_student_id_key" ON "lesson_attendances"("lesson_id", "student_id");
CREATE INDEX "lesson_attendances_student_id_idx"                  ON "lesson_attendances"("student_id");
CREATE INDEX "lesson_attendances_lesson_id_idx"                   ON "lesson_attendances"("lesson_id");

ALTER TABLE "lesson_attendances"
  ADD CONSTRAINT "lesson_attendances_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lesson_attendances"
  ADD CONSTRAINT "lesson_attendances_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
