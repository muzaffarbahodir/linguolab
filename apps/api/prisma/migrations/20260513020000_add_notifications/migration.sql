-- Migration: notifications table
-- Этап: исправление пропущенных (#5)

CREATE TYPE "NotificationChannel" AS ENUM ('TELEGRAM', 'EMAIL');

CREATE TABLE "notifications" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "payload"    JSONB,
  "channel"    "NotificationChannel" NOT NULL DEFAULT 'TELEGRAM',
  "read_at"    TIMESTAMP(3),
  "sent_at"    TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX "notifications_user_id_read_at_idx"    ON "notifications"("user_id", "read_at");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
