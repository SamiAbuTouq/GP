-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "lecturer_access_request" (
    "request_id" SERIAL NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "max_workload" INTEGER NOT NULL,
    "courses" JSONB,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "lecturer_access_request_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE INDEX "lecturer_access_request_status_submitted_at_idx" ON "lecturer_access_request"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "lecturer_access_request_email_status_idx" ON "lecturer_access_request"("email", "status");
