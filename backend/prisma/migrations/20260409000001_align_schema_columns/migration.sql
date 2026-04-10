-- Align legacy migrations with current schema.prisma additions.

-- semester.total_students (optional headcount)
ALTER TABLE "semester"
  ADD COLUMN IF NOT EXISTS "total_students" INTEGER;

-- Unique semester per academic year + type (used by seed + app logic)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'semester_academic_year_semester_type_key'
  ) THEN
    ALTER TABLE "semester"
      ADD CONSTRAINT "semester_academic_year_semester_type_key"
      UNIQUE ("academic_year", "semester_type");
  END IF;
END $$;

-- timeslot uniqueness by (start,end,days_mask)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timeslot_start_time_end_time_days_mask_key'
  ) THEN
    ALTER TABLE "timeslot"
      ADD CONSTRAINT "timeslot_start_time_end_time_days_mask_key"
      UNIQUE ("start_time", "end_time", "days_mask");
  END IF;
END $$;

-- section_schedule_entry additions for analytics
ALTER TABLE "section_schedule_entry"
  ADD COLUMN IF NOT EXISTS "is_lab" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "section_schedule_entry"
  ADD COLUMN IF NOT EXISTS "section_capacity" INTEGER NOT NULL DEFAULT 0;

-- Composite uniqueness to prevent duplicate rows per section/slot in a timetable
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'section_schedule_entry_timetable_id_course_id_section_number_slot_id_key'
  ) THEN
    ALTER TABLE "section_schedule_entry"
      ADD CONSTRAINT "section_schedule_entry_timetable_id_course_id_section_number_slot_id_key"
      UNIQUE ("timetable_id", "course_id", "section_number", "slot_id");
  END IF;
END $$;

-- Helpful indexes for the API route queries
CREATE INDEX IF NOT EXISTS "section_schedule_entry_timetable_id_idx" ON "section_schedule_entry" ("timetable_id");
CREATE INDEX IF NOT EXISTS "section_schedule_entry_course_id_idx" ON "section_schedule_entry" ("course_id");
CREATE INDEX IF NOT EXISTS "section_schedule_entry_user_id_idx" ON "section_schedule_entry" ("user_id");

