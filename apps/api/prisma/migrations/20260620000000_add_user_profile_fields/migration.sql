-- Add optional student profile fields: gender + birth_date

DO $$ BEGIN
  CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gender" "Gender";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birth_date" TIMESTAMP(3);
