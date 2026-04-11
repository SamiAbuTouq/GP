-- Drop timetable-level duplicate; enrollment lives on semester.total_students only.
ALTER TABLE "timetable_metrics" DROP COLUMN IF EXISTS "total_students";
