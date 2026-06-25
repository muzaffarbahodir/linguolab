-- Add is_active flag to User.
-- New users default to false (pending admin activation).
-- All existing users are activated (true) — they predate this requirement.

ALTER TABLE "User" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT false;

-- Activate every user that already exists in the DB.
UPDATE "User" SET "is_active" = true;
