-- Разовая выдача «Первого шага» тем, кто записался раньше.
--
-- Метод onEnrollment существовал с самого начала, но его никто не вызывал:
-- достижение за запись в класс не получал никто. Вызов добавлен, однако он
-- срабатывает только на новых записях, а у уже записавшихся карточка так и
-- осталась бы заблокированной — при том, что условие они выполнили.
--
-- Идемпотентно: ON CONFLICT по паре (user_id, achievement_id) не даст выдать
-- награду дважды, если миграция прогонится повторно.
--
-- Дата разблокировки берётся по первой записи студента, а не текущая: иначе
-- в ленте достижений у всех разом появилось бы «сегодня», хотя записались
-- они месяцы назад.
INSERT INTO "UserAchievement" ("id", "user_id", "achievement_id", "unlocked_at")
SELECT
  -- gen_random_uuid вместо cuid: id генерирует Prisma на клиенте, а здесь
  -- запись создаётся в самой базе. Формат на связи не сказывается.
  gen_random_uuid()::text,
  e."student_id",
  a."id",
  MIN(e."enrolled_at")
FROM "Enrollment" e
CROSS JOIN (
  SELECT "id" FROM "Achievement" WHERE "trigger" = 'FIRST_ENROLLMENT' LIMIT 1
) a
GROUP BY e."student_id", a."id"
ON CONFLICT ("user_id", "achievement_id") DO NOTHING;
