-- Аудитории (кабинеты) очного центра + привязка класса к кабинету.
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rooms_name_key" ON "rooms"("name");

-- Class хранится без @@map (таблица "Class")
ALTER TABLE "Class" ADD COLUMN "room_id" TEXT;

CREATE INDEX "Class_room_id_idx" ON "Class"("room_id");

ALTER TABLE "Class" ADD CONSTRAINT "Class_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
