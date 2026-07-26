-- Отличаем урок, посещаемость которого отметил человек, от закрытого авто-джобом.
--
-- До этого оба выглядели одинаково (status = COMPLETED), из-за чего:
--   * зарплата PER_LESSON начислялась за занятия, которые никто не подтверждал;
--   * напоминание «отметьте посещаемость» искало только SCHEDULED, поэтому
--     после авто-закрытия переставало приходить и данные терялись навсегда.
ALTER TABLE "lessons" ADD COLUMN "attendance_marked_at" TIMESTAMP(3);

-- Бэкофилл: если у урока есть хоть одна отметка посещаемости, значит его
-- закрывал человек. Точного времени отметки в прошлом нет — берём время
-- занятия, это ближайшая честная оценка и она не выдаёт себя за факт.
UPDATE "lessons" l
SET "attendance_marked_at" = l."scheduled_at"
WHERE l."status" = 'COMPLETED'
  AND EXISTS (SELECT 1 FROM "lesson_attendances" a WHERE a."lesson_id" = l."id");

CREATE INDEX "lessons_status_attendance_marked_at_idx"
    ON "lessons"("status", "attendance_marked_at");
