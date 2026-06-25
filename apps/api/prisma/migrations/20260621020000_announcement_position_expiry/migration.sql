-- Announcement: позиция (верх/низ) + срок показа (длительность)
DO $$ BEGIN
  CREATE TYPE "AnnouncementPosition" AS ENUM ('TOP', 'BOTTOM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "position" "AnnouncementPosition" NOT NULL DEFAULT 'TOP';
ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);
