-- CreateEnum
CREATE TYPE "CourseModificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "course_modification_request" (
    "request_id" SERIAL NOT NULL,
    "lecturer_user_id" INTEGER NOT NULL,
    "courses_to_add" JSONB,
    "courses_to_remove" JSONB,
    "note" TEXT,
    "status" "CourseModificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "course_modification_request_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE INDEX "course_modification_request_lecturer_user_id_submitted_at_idx" ON "course_modification_request"("lecturer_user_id", "submitted_at");

-- CreateIndex
CREATE INDEX "course_modification_request_status_submitted_at_idx" ON "course_modification_request"("status", "submitted_at");

-- AddForeignKey
ALTER TABLE "course_modification_request" ADD CONSTRAINT "course_modification_request_lecturer_user_id_fkey" FOREIGN KEY ("lecturer_user_id") REFERENCES "lecturer"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
