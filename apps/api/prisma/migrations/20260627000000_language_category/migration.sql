-- CreateEnum
CREATE TYPE "LanguageCategory" AS ENUM ('LANGUAGES', 'IELTS', 'SAT', 'CEFR', 'DTM', 'MILLIY_SERTIFIKAT');

-- AlterTable
ALTER TABLE "Language" ADD COLUMN "category" "LanguageCategory" NOT NULL DEFAULT 'LANGUAGES';

-- Seed exam/certificate directions (idempotent on unique code)
INSERT INTO "Language" (id, code, name_ru, flag_emoji, category, color, is_active)
VALUES
  (gen_random_uuid()::text, 'ielts',  'IELTS',             '🎓', 'IELTS',             '#E2574C', true),
  (gen_random_uuid()::text, 'sat',    'SAT',               '📐', 'SAT',               '#3B82F6', true),
  (gen_random_uuid()::text, 'cefr',   'CEFR',              '📖', 'CEFR',              '#10B981', true),
  (gen_random_uuid()::text, 'dtm',    'DTM (Davlat testi)','🏛️', 'DTM',               '#8B5CF6', true),
  (gen_random_uuid()::text, 'milliy', 'Milliy sertifikat', '🏅', 'MILLIY_SERTIFIKAT', '#F59E0B', true)
ON CONFLICT (code) DO NOTHING;
