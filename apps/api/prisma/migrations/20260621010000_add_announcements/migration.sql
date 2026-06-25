-- Бегущая строка (announcements) — создаёт SUPER_ADMIN
DO $$ BEGIN
  CREATE TYPE "AnnouncementStyle" AS ENUM ('CAUTION', 'INFO', 'PROMO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Announcement" (
  "id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "style" "AnnouncementStyle" NOT NULL DEFAULT 'CAUTION',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
