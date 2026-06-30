-- Списанные баллы при оформлении оплаты (для записи/возвратов). Идемпотентно.
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "points_spent" INTEGER NOT NULL DEFAULT 0;
