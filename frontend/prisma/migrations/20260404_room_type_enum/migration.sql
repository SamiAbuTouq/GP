-- Migration: Change room_type from integer to RoomType enum (CLASSROOM | LAB)
-- Run this entire script in pgAdmin4 Query Tool against your database.

-- Step 1: Create the new enum type
CREATE TYPE "RoomType" AS ENUM ('CLASSROOM', 'LAB');

-- Step 2: Add a temporary column with the new type
ALTER TABLE "room" ADD COLUMN "room_type_new" "RoomType" NOT NULL DEFAULT 'CLASSROOM'::"RoomType";

-- Step 3: Migrate existing integer values
--   Old: 1=Lecture Hall, 2=Lab, 3=Seminar Room, 4=Computer Lab
--   New: anything that was 2 (Lab) -> LAB, everything else -> CLASSROOM
UPDATE "room"
SET "room_type_new" = CASE
  WHEN room_type = 2 THEN 'LAB'::"RoomType"
  ELSE 'CLASSROOM'::"RoomType"
END;

-- Step 4: Drop the old integer column and rename the new one
ALTER TABLE "room" DROP COLUMN "room_type";
ALTER TABLE "room" RENAME COLUMN "room_type_new" TO "room_type";

-- Step 5: Also add the sections column to course if not already done
ALTER TABLE "course" ADD COLUMN IF NOT EXISTS "sections" INTEGER NOT NULL DEFAULT 1;
