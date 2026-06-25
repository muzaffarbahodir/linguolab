-- AlterTable: add schedule fields to Class
ALTER TABLE "Class" ADD COLUMN "schedule_days"     TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE "Class" ADD COLUMN "schedule_time"     TEXT;
ALTER TABLE "Class" ADD COLUMN "schedule_duration" INTEGER;
