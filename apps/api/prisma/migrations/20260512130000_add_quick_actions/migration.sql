-- CreateEnum
CREATE TYPE "TrialStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateTable
CREATE TABLE "TrialLessonRequest" (
    "id"          TEXT NOT NULL,
    "student_id"  TEXT NOT NULL,
    "language_id" TEXT NOT NULL,
    "note"        TEXT,
    "status"      "TrialStatus" NOT NULL DEFAULT 'PENDING',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialLessonRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id"         TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "subject"    TEXT NOT NULL,
    "message"    TEXT NOT NULL,
    "status"     "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id"          TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "used_count"  INTEGER NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrialLessonRequest_student_id_idx"  ON "TrialLessonRequest"("student_id");
CREATE INDEX "TrialLessonRequest_status_idx"       ON "TrialLessonRequest"("status");
CREATE INDEX "SupportTicket_student_id_idx"        ON "SupportTicket"("student_id");
CREATE INDEX "SupportTicket_status_idx"            ON "SupportTicket"("status");
CREATE UNIQUE INDEX "Referral_referrer_id_key"     ON "Referral"("referrer_id");
CREATE UNIQUE INDEX "Referral_code_key"            ON "Referral"("code");

-- AddForeignKey
ALTER TABLE "TrialLessonRequest" ADD CONSTRAINT "TrialLessonRequest_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrialLessonRequest" ADD CONSTRAINT "TrialLessonRequest_language_id_fkey"
    FOREIGN KEY ("language_id") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrer_id_fkey"
    FOREIGN KEY ("referrer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
