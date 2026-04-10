-- Ensure DeliveryMode enum exists (older migrations created VARCHAR column).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryMode') THEN
    CREATE TYPE "DeliveryMode" AS ENUM ('ONLINE', 'BLENDED', 'FACE_TO_FACE');
  END IF;
END $$;

-- Normalize any legacy values before type conversion.
UPDATE "course"
SET "delivery_mode" = CASE
  WHEN lower("delivery_mode") = 'online' THEN 'ONLINE'
  WHEN lower("delivery_mode") = 'blended' THEN 'BLENDED'
  WHEN lower("delivery_mode") IN ('face-to-face', 'face_to_face', 'face to face', 'in-person', 'in person', 'no') THEN 'FACE_TO_FACE'
  WHEN "delivery_mode" IN ('ONLINE', 'BLENDED', 'FACE_TO_FACE') THEN "delivery_mode"
  ELSE 'FACE_TO_FACE'
END
WHERE "delivery_mode" IS NOT NULL;

-- Convert column type from VARCHAR/TEXT to enum.
ALTER TABLE "course"
  ALTER COLUMN "delivery_mode" TYPE "DeliveryMode"
  USING ("delivery_mode"::"DeliveryMode");

