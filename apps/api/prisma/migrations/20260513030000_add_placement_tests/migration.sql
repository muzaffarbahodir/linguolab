-- Migration: placement_tests table
-- Этап: исправление пропущенных (#6)

CREATE TYPE "PlacementTestStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'EXPIRED');

CREATE TABLE "placement_tests" (
  "id"             TEXT NOT NULL,
  "user_id"        TEXT NOT NULL,
  "language_id"    TEXT NOT NULL,
  "status"         "PlacementTestStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "answers"        JSONB NOT NULL DEFAULT '[]',
  "score"          INTEGER,
  "level_assigned" "CEFR",
  "started_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"   TIMESTAMP(3),
  "expires_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "placement_tests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "placement_tests_user_id_status_idx" ON "placement_tests"("user_id", "status");
CREATE INDEX "placement_tests_expires_at_idx"     ON "placement_tests"("expires_at");

ALTER TABLE "placement_tests"
  ADD CONSTRAINT "placement_tests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "placement_tests"
  ADD CONSTRAINT "placement_tests_language_id_fkey"
  FOREIGN KEY ("language_id") REFERENCES "Language"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
