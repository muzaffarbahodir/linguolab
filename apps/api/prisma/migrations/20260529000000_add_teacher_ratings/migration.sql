-- CreateTable
CREATE TABLE "teacher_ratings" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_ratings_teacher_id_idx" ON "teacher_ratings"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_ratings_student_id_class_id_key" ON "teacher_ratings"("student_id", "class_id");

-- AddForeignKey
ALTER TABLE "teacher_ratings" ADD CONSTRAINT "teacher_ratings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_ratings" ADD CONSTRAINT "teacher_ratings_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_ratings" ADD CONSTRAINT "teacher_ratings_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
