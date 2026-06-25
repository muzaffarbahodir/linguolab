-- Migration: add is_trial to enrollments + extend referrals
-- Этап: исправление пропущенных полей (#2 и #3)

-- #2: Флаг пробного урока на Enrollment
ALTER TABLE "Enrollment" ADD COLUMN "is_trial" BOOLEAN NOT NULL DEFAULT false;

-- #3: Расширение Referral — invitee, redeemed_at, bonus_days
ALTER TABLE "Referral" ADD COLUMN "invitee_id"          TEXT;
ALTER TABLE "Referral" ADD COLUMN "redeemed_at"         TIMESTAMP(3);
ALTER TABLE "Referral" ADD COLUMN "bonus_days_granted"  INTEGER NOT NULL DEFAULT 0;

-- Индекс на invitee_id для быстрого поиска
CREATE INDEX "Referral_invitee_id_idx" ON "Referral"("invitee_id");

-- FK: Referral.invitee_id → User.id (ON DELETE SET NULL)
ALTER TABLE "Referral"
  ADD CONSTRAINT "Referral_invitee_id_fkey"
  FOREIGN KEY ("invitee_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
