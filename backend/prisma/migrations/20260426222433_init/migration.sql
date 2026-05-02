-- DropForeignKey
ALTER TABLE "timetable" DROP CONSTRAINT "timetable_semester_id_fkey";

-- AddForeignKey
ALTER TABLE "timetable" ADD CONSTRAINT "timetable_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semester"("semester_id") ON DELETE SET NULL ON UPDATE CASCADE;
