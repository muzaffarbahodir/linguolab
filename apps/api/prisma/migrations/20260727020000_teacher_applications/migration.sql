-- Заявка «хочу преподавать» от человека, которого ещё нет среди учителей.
--
-- Кандидата, заведённого администратором заранее, приложение пускает в
-- преподавательский кабинет сразу. Всем остальным нужен разговор с центром —
-- анкета уходит менеджеру вместо того, чтобы теряться в переписке.

CREATE TYPE "TeacherApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "teacher_applications" (
    "id"               TEXT NOT NULL,
    "user_id"          TEXT NOT NULL,
    "subject"          TEXT NOT NULL,
    "age"              INTEGER,
    "experience_years" INTEGER,
    "certificates"     TEXT,
    "about"            TEXT,
    "status"           "TeacherApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note"       TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at"      TIMESTAMP(3),

    CONSTRAINT "teacher_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "teacher_applications_status_created_at_idx"
    ON "teacher_applications"("status", "created_at");
CREATE INDEX "teacher_applications_user_id_idx"
    ON "teacher_applications"("user_id");

ALTER TABLE "teacher_applications" ADD CONSTRAINT "teacher_applications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
