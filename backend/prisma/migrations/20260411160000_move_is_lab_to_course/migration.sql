-- Lab flag is per-course (CSV islab / course metadata), not per schedule row.
ALTER TABLE "course" ADD COLUMN IF NOT EXISTS "is_lab" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'section_schedule_entry'
      AND column_name = 'is_lab'
  ) THEN
    UPDATE "course" c
    SET "is_lab" = true
    WHERE EXISTS (
      SELECT 1
      FROM "section_schedule_entry" e
      WHERE e.course_id = c.course_id
        AND e.is_lab = true
    );
  END IF;
END $$;

ALTER TABLE "section_schedule_entry" DROP COLUMN IF EXISTS "is_lab";
