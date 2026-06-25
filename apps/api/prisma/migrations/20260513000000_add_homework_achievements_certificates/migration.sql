-- Этап 10: ДЗ + достижения + сертификаты

-- Enums
CREATE TYPE "HomeworkSubmissionStatus" AS ENUM ('SUBMITTED', 'GRADED', 'LATE');
CREATE TYPE "AchievementTrigger" AS ENUM (
  'FIRST_ENROLLMENT',
  'FIRST_HOMEWORK',
  'HOMEWORK_STREAK_5',
  'HOMEWORK_STREAK_10',
  'PERFECT_GRADE',
  'TRIAL_COMPLETED',
  'REFERRAL_1'
);

-- Homework
CREATE TABLE "Homework" (
  "id"          TEXT NOT NULL,
  "class_id"    TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "due_date"    TIMESTAMP(3),
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Homework_class_id_idx" ON "Homework"("class_id");
CREATE INDEX "Homework_due_date_idx" ON "Homework"("due_date");
ALTER TABLE "Homework"
  ADD CONSTRAINT "Homework_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- HomeworkSubmission
CREATE TABLE "HomeworkSubmission" (
  "id"           TEXT NOT NULL,
  "homework_id"  TEXT NOT NULL,
  "student_id"   TEXT NOT NULL,
  "file_key"     TEXT,
  "file_url"     TEXT,
  "text_answer"  TEXT,
  "status"       "HomeworkSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "grade"        INTEGER,
  "feedback"     TEXT,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "graded_at"    TIMESTAMP(3),
  CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HomeworkSubmission_homework_id_student_id_key"
  ON "HomeworkSubmission"("homework_id", "student_id");
CREATE INDEX "HomeworkSubmission_student_id_idx" ON "HomeworkSubmission"("student_id");
CREATE INDEX "HomeworkSubmission_homework_id_status_idx"
  ON "HomeworkSubmission"("homework_id", "status");
ALTER TABLE "HomeworkSubmission"
  ADD CONSTRAINT "HomeworkSubmission_homework_id_fkey"
  FOREIGN KEY ("homework_id") REFERENCES "Homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HomeworkSubmission"
  ADD CONSTRAINT "HomeworkSubmission_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Achievement
CREATE TABLE "Achievement" (
  "id"             TEXT NOT NULL,
  "key"            TEXT NOT NULL,
  "title_ru"       TEXT NOT NULL,
  "title_uz"       TEXT,
  "title_en"       TEXT,
  "description_ru" TEXT NOT NULL,
  "description_uz" TEXT,
  "description_en" TEXT,
  "icon"           TEXT NOT NULL,
  "trigger"        "AchievementTrigger" NOT NULL,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- UserAchievement
CREATE TABLE "UserAchievement" (
  "id"             TEXT NOT NULL,
  "user_id"        TEXT NOT NULL,
  "achievement_id" TEXT NOT NULL,
  "unlocked_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserAchievement_user_id_achievement_id_key"
  ON "UserAchievement"("user_id", "achievement_id");
CREATE INDEX "UserAchievement_user_id_idx" ON "UserAchievement"("user_id");
ALTER TABLE "UserAchievement"
  ADD CONSTRAINT "UserAchievement_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserAchievement"
  ADD CONSTRAINT "UserAchievement_achievement_id_fkey"
  FOREIGN KEY ("achievement_id") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Certificate
CREATE TABLE "Certificate" (
  "id"         TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "class_id"   TEXT NOT NULL,
  "file_key"   TEXT NOT NULL,
  "file_url"   TEXT NOT NULL,
  "issued_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Certificate_student_id_class_id_key"
  ON "Certificate"("student_id", "class_id");
CREATE INDEX "Certificate_student_id_idx" ON "Certificate"("student_id");
ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: Achievement records
INSERT INTO "Achievement" ("id", "key", "title_ru", "title_uz", "title_en",
  "description_ru", "description_uz", "description_en", "icon", "trigger", "created_at")
VALUES
  (gen_random_uuid()::text, 'first_enrollment',
   'Первый шаг', 'Birinchi qadam', 'First Step',
   'Записался в первый класс', 'Birinchi darsga yozildingiz', 'Enrolled in first class',
   '🎯', 'FIRST_ENROLLMENT', NOW()),
  (gen_random_uuid()::text, 'first_homework',
   'Прилежный студент', 'Tirishqoq talaba', 'Diligent Student',
   'Сдал первое домашнее задание', 'Birinchi uy vazifasini topshirdingiz', 'Submitted first homework',
   '📝', 'FIRST_HOMEWORK', NOW()),
  (gen_random_uuid()::text, 'homework_streak_5',
   'Пять подряд', 'Ketma-ket beshta', 'Five in a Row',
   'Сдал 5 ДЗ подряд без пропуска', '5 ta uy vazifasini ketma-ket topshirdingiz', 'Submitted 5 homeworks in a row',
   '🔥', 'HOMEWORK_STREAK_5', NOW()),
  (gen_random_uuid()::text, 'homework_streak_10',
   'Отличник', 'A''lochi', 'Honor Student',
   'Сдал 10 ДЗ подряд без пропуска', '10 ta uy vazifasini ketma-ket topshirdingiz', 'Submitted 10 homeworks in a row',
   '⭐', 'HOMEWORK_STREAK_10', NOW()),
  (gen_random_uuid()::text, 'perfect_grade',
   'Идеальный результат', 'Mukammal natija', 'Perfect Score',
   'Получил 100 баллов за домашнее задание', 'Uy vazifasi uchun 100 ball oldingiz', 'Got 100 points for homework',
   '💯', 'PERFECT_GRADE', NOW()),
  (gen_random_uuid()::text, 'trial_completed',
   'Попробовал на вкус', 'Sinab ko''rdim', 'Tried It Out',
   'Завершил пробный урок', 'Sinov darsini yakunladingiz', 'Completed trial lesson',
   '🎓', 'TRIAL_COMPLETED', NOW()),
  (gen_random_uuid()::text, 'referral_1',
   'Амбассадор', 'Ambassador', 'Ambassador',
   'Пригласил первого друга', 'Birinchi do''stingizni taklif qildingiz', 'Invited first friend',
   '🎁', 'REFERRAL_1', NOW());
