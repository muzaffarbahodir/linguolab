-- Прогресс мини-игр (XP/уровень + SRS): кросс-девайс хранилище на стороне пользователя.
-- Идемпотентно — таблица "User" в PascalCase (без @@map).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "game_progress" JSONB;
