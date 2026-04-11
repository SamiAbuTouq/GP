-- section_schedule_entry.section_capacity is derived at read time from
-- delivery_mode, registered_students, and room.capacity.
ALTER TABLE "section_schedule_entry" DROP COLUMN IF EXISTS "section_capacity";
