-- Витрина преподавателя.
--
-- До записи студент видел имя, аватар и звёзды — этого мало, чтобы выбрать, у
-- кого учиться. Добавляем то, что на самом деле решает: видео-визитку (как
-- человек говорит), стаж, специализации и языки владения.
--
-- Массивы с DEFAULT '{}' и NOT NULL: пустой список и отсутствие списка здесь
-- значат одно и то же, а NULL в String[] заставлял бы каждого читателя
-- проверять его отдельно.

ALTER TABLE "Teacher"
  ADD COLUMN "headline"           TEXT,
  ADD COLUMN "intro_video_url"    TEXT,
  ADD COLUMN "intro_video_poster" TEXT,
  ADD COLUMN "country"            TEXT,
  ADD COLUMN "experience_years"   INTEGER,
  ADD COLUMN "specializations"    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "highlights"         TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "speaks"             JSONB,
  ADD COLUMN "education"          JSONB;
