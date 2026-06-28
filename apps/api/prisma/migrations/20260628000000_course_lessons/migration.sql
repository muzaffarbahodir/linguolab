-- Программа курса (силлабус): уроки/темы направления с материалами и превью.
CREATE TABLE "course_lessons" (
    "id" TEXT NOT NULL,
    "language_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration_min" INTEGER,
    "is_preview" BOOLEAN NOT NULL DEFAULT false,
    "video_url" TEXT,
    "materials" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "course_lessons_language_id_order_idx" ON "course_lessons"("language_id", "order");

ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_language_id_fkey"
    FOREIGN KEY ("language_id") REFERENCES "languages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
