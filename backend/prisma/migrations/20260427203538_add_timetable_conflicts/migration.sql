-- CreateTable
CREATE TABLE "timetable_conflict" (
    "conflict_id" SERIAL NOT NULL,
    "timetable_id" INTEGER NOT NULL,
    "conflict_type" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "course_code" VARCHAR(30) NOT NULL,
    "section_number" VARCHAR(20) NOT NULL,
    "lecturer_name" VARCHAR(150),
    "room_number" VARCHAR(60),
    "timeslot_label" VARCHAR(120),
    "detail" TEXT NOT NULL,

    CONSTRAINT "timetable_conflict_pkey" PRIMARY KEY ("conflict_id")
);

-- CreateIndex
CREATE INDEX "timetable_conflict_timetable_id_idx" ON "timetable_conflict"("timetable_id");

-- AddForeignKey
ALTER TABLE "timetable_conflict" ADD CONSTRAINT "timetable_conflict_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetable"("timetable_id") ON DELETE CASCADE ON UPDATE CASCADE;
