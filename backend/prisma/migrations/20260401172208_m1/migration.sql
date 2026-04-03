-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LECTURER');

-- CreateTable
CREATE TABLE "user" (
    "user_id" SERIAL NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "avatar_url" VARCHAR(500),
    "role_name" "Role" NOT NULL,
    "theme_preference" VARCHAR(20),
    "date_format" VARCHAR(20),
    "time_format" VARCHAR(20),

    CONSTRAINT "user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" SERIAL NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department" (
    "dept_id" SERIAL NOT NULL,
    "dept_name" VARCHAR(100) NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("dept_id")
);

-- CreateTable
CREATE TABLE "lecturer" (
    "user_id" INTEGER NOT NULL,
    "dept_id" INTEGER NOT NULL,
    "max_workload" INTEGER NOT NULL,
    "is_available" BOOLEAN NOT NULL,

    CONSTRAINT "lecturer_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "course" (
    "course_id" SERIAL NOT NULL,
    "dept_id" INTEGER NOT NULL,
    "course_code" VARCHAR(20) NOT NULL,
    "course_name" VARCHAR(100) NOT NULL,
    "academic_level" INTEGER NOT NULL,
    "credit_hours" INTEGER NOT NULL,
    "delivery_mode" VARCHAR(30) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("course_id")
);

-- CreateTable
CREATE TABLE "course_prerequisite" (
    "course_id" INTEGER NOT NULL,
    "prerequisite_id" INTEGER NOT NULL,

    CONSTRAINT "course_prerequisite_pkey" PRIMARY KEY ("course_id","prerequisite_id")
);

-- CreateTable
CREATE TABLE "room" (
    "room_id" SERIAL NOT NULL,
    "room_number" VARCHAR(30) NOT NULL,
    "room_type" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "is_available" BOOLEAN NOT NULL,

    CONSTRAINT "room_pkey" PRIMARY KEY ("room_id")
);

-- CreateTable
CREATE TABLE "timeslot" (
    "slot_id" SERIAL NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "days_mask" INTEGER NOT NULL,
    "slot_type" VARCHAR(30) NOT NULL,

    CONSTRAINT "timeslot_pkey" PRIMARY KEY ("slot_id")
);

-- CreateTable
CREATE TABLE "semester" (
    "semester_id" SERIAL NOT NULL,
    "semester_type" INTEGER NOT NULL,
    "academic_year" VARCHAR(9) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,

    CONSTRAINT "semester_pkey" PRIMARY KEY ("semester_id")
);

-- CreateTable
CREATE TABLE "scenario" (
    "scenario_id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "scenario_pkey" PRIMARY KEY ("scenario_id")
);

-- CreateTable
CREATE TABLE "timetable" (
    "timetable_id" SERIAL NOT NULL,
    "semester_id" INTEGER NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(30) NOT NULL,
    "generation_type" VARCHAR(30) NOT NULL,
    "version_number" INTEGER NOT NULL,

    CONSTRAINT "timetable_pkey" PRIMARY KEY ("timetable_id")
);

-- CreateTable
CREATE TABLE "timetable_metrics" (
    "timetable_id" INTEGER NOT NULL,
    "room_utilization_rate" DECIMAL(5,2) NOT NULL,
    "soft_constraints_score" DECIMAL(5,2) NOT NULL,
    "fitness_score" DECIMAL(5,2) NOT NULL,
    "is_valid" BOOLEAN NOT NULL,
    "total_students" INTEGER NOT NULL,

    CONSTRAINT "timetable_metrics_pkey" PRIMARY KEY ("timetable_id")
);

-- CreateTable
CREATE TABLE "notification" (
    "notification_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "message_title" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "lecturer_preference" (
    "user_id" INTEGER NOT NULL,
    "slot_id" INTEGER NOT NULL,
    "is_preferred" BOOLEAN NOT NULL,

    CONSTRAINT "lecturer_preference_pkey" PRIMARY KEY ("user_id","slot_id")
);

-- CreateTable
CREATE TABLE "lecturer_can_teach_course" (
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,

    CONSTRAINT "lecturer_can_teach_course_pkey" PRIMARY KEY ("user_id","course_id")
);

-- CreateTable
CREATE TABLE "lecturer_office_hours" (
    "user_id" INTEGER NOT NULL,
    "slot_id" INTEGER NOT NULL,

    CONSTRAINT "lecturer_office_hours_pkey" PRIMARY KEY ("user_id","slot_id")
);

-- CreateTable
CREATE TABLE "section_schedule_entry" (
    "entry_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "slot_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "timetable_id" INTEGER NOT NULL,
    "room_id" INTEGER NOT NULL,
    "registered_students" INTEGER NOT NULL,
    "section_number" VARCHAR(10) NOT NULL,

    CONSTRAINT "section_schedule_entry_pkey" PRIMARY KEY ("entry_id")
);

-- CreateTable
CREATE TABLE "scenario_produces_timetable" (
    "timetable_id" INTEGER NOT NULL,
    "scenario_id" INTEGER NOT NULL,

    CONSTRAINT "scenario_produces_timetable_pkey" PRIMARY KEY ("timetable_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "refresh_token_user_id_idx" ON "refresh_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_course_code_key" ON "course"("course_code");

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer" ADD CONSTRAINT "lecturer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer" ADD CONSTRAINT "lecturer_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "department"("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "department"("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisite" ADD CONSTRAINT "course_prerequisite_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisite" ADD CONSTRAINT "course_prerequisite_prerequisite_id_fkey" FOREIGN KEY ("prerequisite_id") REFERENCES "course"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable" ADD CONSTRAINT "timetable_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semester"("semester_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_metrics" ADD CONSTRAINT "timetable_metrics_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetable"("timetable_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_preference" ADD CONSTRAINT "lecturer_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lecturer"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_preference" ADD CONSTRAINT "lecturer_preference_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "timeslot"("slot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_can_teach_course" ADD CONSTRAINT "lecturer_can_teach_course_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lecturer"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_can_teach_course" ADD CONSTRAINT "lecturer_can_teach_course_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_office_hours" ADD CONSTRAINT "lecturer_office_hours_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lecturer"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_office_hours" ADD CONSTRAINT "lecturer_office_hours_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "timeslot"("slot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_schedule_entry" ADD CONSTRAINT "section_schedule_entry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lecturer"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_schedule_entry" ADD CONSTRAINT "section_schedule_entry_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "timeslot"("slot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_schedule_entry" ADD CONSTRAINT "section_schedule_entry_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "course"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_schedule_entry" ADD CONSTRAINT "section_schedule_entry_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetable"("timetable_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "section_schedule_entry" ADD CONSTRAINT "section_schedule_entry_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_produces_timetable" ADD CONSTRAINT "scenario_produces_timetable_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetable"("timetable_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_produces_timetable" ADD CONSTRAINT "scenario_produces_timetable_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenario"("scenario_id") ON DELETE CASCADE ON UPDATE CASCADE;
