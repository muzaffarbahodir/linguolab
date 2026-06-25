-- Add WAITLIST to EnrollmentStatus enum
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'WAITLIST';

-- Add TransferStatus enum
DO $$ BEGIN
    CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new fields to Teacher
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "website_url" TEXT;
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "instagram_url" TEXT;
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "telegram_url" TEXT;

-- CreateTable teacher_badges
CREATE TABLE IF NOT EXISTS "teacher_badges" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'badge',
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awarded_by" TEXT NOT NULL,

    CONSTRAINT "teacher_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "teacher_badges_teacher_id_idx" ON "teacher_badges"("teacher_id");

-- AddForeignKey
ALTER TABLE "teacher_badges" DROP CONSTRAINT IF EXISTS "teacher_badges_teacher_id_fkey";
ALTER TABLE "teacher_badges" ADD CONSTRAINT "teacher_badges_teacher_id_fkey"
    FOREIGN KEY ("teacher_id") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable class_transfer_requests
CREATE TABLE IF NOT EXISTS "class_transfer_requests" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "from_class_id" TEXT NOT NULL,
    "to_class_id" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "fee_uzs" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "class_transfer_requests_student_id_status_idx"
    ON "class_transfer_requests"("student_id", "status");
CREATE INDEX IF NOT EXISTS "class_transfer_requests_status_created_at_idx"
    ON "class_transfer_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "class_transfer_requests" DROP CONSTRAINT IF EXISTS "class_transfer_requests_student_id_fkey";
ALTER TABLE "class_transfer_requests" ADD CONSTRAINT "class_transfer_requests_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "class_transfer_requests" DROP CONSTRAINT IF EXISTS "class_transfer_requests_from_class_id_fkey";
ALTER TABLE "class_transfer_requests" ADD CONSTRAINT "class_transfer_requests_from_class_id_fkey"
    FOREIGN KEY ("from_class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_transfer_requests" DROP CONSTRAINT IF EXISTS "class_transfer_requests_to_class_id_fkey";
ALTER TABLE "class_transfer_requests" ADD CONSTRAINT "class_transfer_requests_to_class_id_fkey"
    FOREIGN KEY ("to_class_id") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
