-- Announcement: аудитория (роли + конкретный юзер) + регулярность
DO $$ BEGIN
  CREATE TYPE "AnnouncementRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "audience_roles" "Role"[] NOT NULL DEFAULT ARRAY[]::"Role"[];
ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "target_user_id" TEXT;
ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "recurrence" "AnnouncementRecurrence" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "recurrence_day" INTEGER;
ALTER TABLE "Announcement"
  ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER;
