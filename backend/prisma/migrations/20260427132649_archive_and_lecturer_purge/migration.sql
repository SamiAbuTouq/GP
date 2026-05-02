-- DropForeignKey
ALTER TABLE "section_schedule_entry" DROP CONSTRAINT "section_schedule_entry_user_id_fkey";

-- AlterTable
ALTER TABLE "course" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "section_schedule_entry" ADD COLUMN     "lecturer_name_snapshot" VARCHAR(150),
ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "timeslot" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "section_schedule_entry" ADD CONSTRAINT "section_schedule_entry_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "lecturer"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
