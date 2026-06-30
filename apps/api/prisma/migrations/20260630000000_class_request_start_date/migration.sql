-- Учитель задаёт желаемую дату начала (и конца) курса прямо в заявке на открытие.
-- На апруве переносится в Class.starts_at/ends_at. Идемпотентно; таблица @@map "class_requests".
ALTER TABLE "class_requests" ADD COLUMN IF NOT EXISTS "starts_at" TIMESTAMP(3);
ALTER TABLE "class_requests" ADD COLUMN IF NOT EXISTS "ends_at" TIMESTAMP(3);
