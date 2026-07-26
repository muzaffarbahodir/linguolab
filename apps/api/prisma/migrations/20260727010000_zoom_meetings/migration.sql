-- Конференция на каждое занятие + источник посещаемости.
--
-- До этого ссылка на онлайн-урок была одним текстовым полем на весь курс:
-- её можно переслать кому угодно, нельзя связать с записью конкретного
-- занятия и невозможно понять, кто на нём был.

CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'ZOOM');

ALTER TABLE "lessons"
  ADD COLUMN "attendance_source"  "AttendanceSource",
  ADD COLUMN "zoom_meeting_id"    TEXT,
  ADD COLUMN "zoom_join_url"      TEXT,
  ADD COLUMN "zoom_start_url"     TEXT,
  ADD COLUMN "zoom_recording_url" TEXT;

-- Всё, что было отмечено до появления интеграции, отмечено человеком.
UPDATE "lessons"
SET "attendance_source" = 'MANUAL'
WHERE "attendance_marked_at" IS NOT NULL;

-- Вебхук приходит с id конференции — по нему находим занятие.
CREATE INDEX "lessons_zoom_meeting_id_idx" ON "lessons"("zoom_meeting_id");
