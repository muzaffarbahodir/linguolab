-- Migration: semester_system
-- Stage A: ClassStatus enum, ClassRequestStatus enum, Class additions,
--          Enrollment additions, Payment.enrollment_id, ClassRequest model

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "ClassStatus" AS ENUM (
  'DRAFT',
  'ENROLLMENT_OPEN',
  'ACTIVE',
  'EXAM',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "ClassRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

-- ─── Class: new columns ───────────────────────────────────────────────────────

-- price_usd: fixed USD price, NOT NULL — default 0 for existing rows (admin sets real values)
ALTER TABLE "Class" ADD COLUMN "price_usd" INTEGER NOT NULL DEFAULT 0;

-- semester lifecycle status — existing classes are already active
ALTER TABLE "Class" ADD COLUMN "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE';

-- semester label e.g. "2026-07"
ALTER TABLE "Class" ADD COLUMN "semester_label" TEXT;

-- enrollment window
ALTER TABLE "Class" ADD COLUMN "enrollment_opens_at"  TIMESTAMPTZ;
ALTER TABLE "Class" ADD COLUMN "enrollment_closes_at" TIMESTAMPTZ;

-- semester dates
ALTER TABLE "Class" ADD COLUMN "starts_at" TIMESTAMPTZ;
ALTER TABLE "Class" ADD COLUMN "ends_at"   TIMESTAMPTZ;

-- indexes
CREATE INDEX "Class_status_idx"          ON "Class"("status");
CREATE INDEX "Class_semester_label_idx"  ON "Class"("semester_label");

-- ─── Enrollment: new columns ──────────────────────────────────────────────────

ALTER TABLE "Enrollment" ADD COLUMN "trial_expires_at" TIMESTAMPTZ;

CREATE INDEX "Enrollment_status_idx"           ON "Enrollment"("status");
CREATE INDEX "Enrollment_trial_expires_at_idx" ON "Enrollment"("trial_expires_at");

-- ─── Payment: enrollment link ─────────────────────────────────────────────────

ALTER TABLE "payments" ADD COLUMN "enrollment_id" TEXT REFERENCES "Enrollment"("id") ON DELETE SET NULL;

CREATE INDEX "payments_enrollment_id_idx" ON "payments"("enrollment_id");

-- ─── ClassRequest ─────────────────────────────────────────────────────────────

CREATE TABLE "class_requests" (
  "id"                TEXT        NOT NULL DEFAULT gen_random_uuid(),
  "teacher_id"        TEXT        NOT NULL,
  "language_id"       TEXT        NOT NULL,
  "title"             TEXT        NOT NULL,
  "level"             "CEFR"      NOT NULL,
  "description"       TEXT,
  "schedule_days"     TEXT[]      NOT NULL DEFAULT '{}',
  "schedule_time"     TEXT,
  "schedule_duration" INTEGER,
  "max_students"      INTEGER     NOT NULL DEFAULT 10,
  "note"              TEXT,
  "status"            "ClassRequestStatus" NOT NULL DEFAULT 'PENDING',
  "admin_note"        TEXT,
  "approved_class_id" TEXT,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "class_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_requests_teacher_id_fkey"
    FOREIGN KEY ("teacher_id") REFERENCES "Teacher"("id") ON DELETE CASCADE,
  CONSTRAINT "class_requests_language_id_fkey"
    FOREIGN KEY ("language_id") REFERENCES "Language"("id"),
  CONSTRAINT "class_requests_approved_class_id_fkey"
    FOREIGN KEY ("approved_class_id") REFERENCES "Class"("id") ON DELETE SET NULL
);

CREATE INDEX "class_requests_teacher_id_status_idx" ON "class_requests"("teacher_id", "status");
CREATE INDEX "class_requests_status_created_at_idx"  ON "class_requests"("status", "created_at");

-- updated_at trigger (reuse existing pattern)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER class_requests_updated_at
  BEFORE UPDATE ON "class_requests"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
