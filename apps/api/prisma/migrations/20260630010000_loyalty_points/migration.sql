-- Система лояльных баллов (кэшбэк). Идемпотентно.
-- Таблицы: "User"/"Referral" — PascalCase (без @@map); point_transactions — @@map.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "total_earned_points" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Referral" ADD COLUMN IF NOT EXISTS "points_granted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "point_transactions" (
  "id"          TEXT NOT NULL,
  "user_id"     TEXT NOT NULL,
  "amount"      INTEGER NOT NULL,
  "type"        TEXT NOT NULL,
  "description" TEXT,
  "payment_id"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "point_transactions_user_id_created_at_idx"
  ON "point_transactions" ("user_id", "created_at");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'point_transactions_user_id_fkey') THEN
    ALTER TABLE "point_transactions"
      ADD CONSTRAINT "point_transactions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
