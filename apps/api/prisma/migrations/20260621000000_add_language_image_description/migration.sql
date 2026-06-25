-- Language: картинка вместо цвета + описание (редактирует супер-админ)
ALTER TABLE "Language" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "Language" ADD COLUMN IF NOT EXISTS "description" TEXT;
