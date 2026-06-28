-- Отзывы студентов на курс (направление).
CREATE TABLE "course_reviews" (
    "id" TEXT NOT NULL,
    "language_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_reviews_language_id_student_id_key"
    ON "course_reviews"("language_id", "student_id");

CREATE INDEX "course_reviews_language_id_is_hidden_idx"
    ON "course_reviews"("language_id", "is_hidden");

ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_language_id_fkey"
    FOREIGN KEY ("language_id") REFERENCES "Language"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
