/*
  Warnings:

  - A unique constraint covering the columns `[reset_token]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "course" ADD COLUMN     "sections" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "reset_token" VARCHAR(255),
ADD COLUMN     "reset_token_expiry" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "user_reset_token_key" ON "user"("reset_token");
