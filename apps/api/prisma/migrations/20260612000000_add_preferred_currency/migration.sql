-- AddColumn preferred_currency to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferred_currency" TEXT NOT NULL DEFAULT 'UZS';
