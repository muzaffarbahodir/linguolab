-- CreateTable
CREATE TABLE "teacher_offers" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "language_id" TEXT NOT NULL,
    "level" "CEFR",
    "format" "StudyFormat",
    "price_uzs" INTEGER NOT NULL DEFAULT 0,
    "price_usd" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_offers_language_id_idx" ON "teacher_offers"("language_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_offers_teacher_id_language_id_key" ON "teacher_offers"("teacher_id", "language_id");

-- AddForeignKey
ALTER TABLE "teacher_offers" ADD CONSTRAINT "teacher_offers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_offers" ADD CONSTRAINT "teacher_offers_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
