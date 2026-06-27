-- CreateEnum
CREATE TYPE "StudyFormat" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "StudyMode" AS ENUM ('INDIVIDUAL', 'GROUP');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "study_format" "StudyFormat";
ALTER TABLE "User" ADD COLUMN "study_mode" "StudyMode";
ALTER TABLE "User" ADD COLUMN "preferred_category" "LanguageCategory";
ALTER TABLE "User" ADD COLUMN "discovery_done_at" TIMESTAMP(3);
