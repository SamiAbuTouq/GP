/*
  Warnings:

  - The primary key for the `scenario_produces_timetable` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "scenario_produces_timetable" DROP CONSTRAINT "scenario_produces_timetable_pkey",
ADD CONSTRAINT "scenario_produces_timetable_pkey" PRIMARY KEY ("timetable_id", "scenario_id");

-- CreateIndex
CREATE INDEX "notification_user_id_idx" ON "notification"("user_id");

-- CreateIndex
CREATE INDEX "timetable_semester_id_idx" ON "timetable"("semester_id");

-- RenameIndex
ALTER INDEX "section_schedule_entry_timetable_id_course_id_section_number_sl" RENAME TO "section_schedule_entry_timetable_id_course_id_section_numbe_key";
