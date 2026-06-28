-- Помесячная оплата: до какой даты оплачено обучение + период платежа (месяцев).
ALTER TABLE "Enrollment" ADD COLUMN "paid_until" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "period_months" INTEGER NOT NULL DEFAULT 1;
