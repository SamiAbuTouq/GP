-- Allow draft timetables without a semester/year.
ALTER TABLE "timetable"
ALTER COLUMN "semester_id" DROP NOT NULL;
