-- Semester type on timeslots (normal = first/second, summer = summer term)
ALTER TABLE "timeslot" ADD COLUMN "is_summer" BOOLEAN NOT NULL DEFAULT false;

-- Replace single composite unique with one that includes semester type
ALTER TABLE "timeslot" DROP CONSTRAINT IF EXISTS "timeslot_start_time_end_time_days_mask_key";

ALTER TABLE "timeslot"
  ADD CONSTRAINT "timeslot_start_time_end_time_days_mask_is_summer_key"
  UNIQUE ("start_time", "end_time", "days_mask", "is_summer");

-- Course: parallel section counts per semester kind (historical seed uses latest term per kind)
ALTER TABLE "course" ADD COLUMN "sections_summer" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "course" RENAME COLUMN "sections" TO "sections_normal";
