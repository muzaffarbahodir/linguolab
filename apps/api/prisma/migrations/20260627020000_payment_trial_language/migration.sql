-- AlterTable: платёж за очный пробный урок (заявка создаётся после оплаты)
ALTER TABLE "payments" ADD COLUMN "trial_language_id" TEXT;
