-- Allow seeding separate Traditional vs Blended slots that share the same calendar pattern.
-- Replace unique constraint on timeslot to include slot_type.

ALTER TABLE "timeslot" DROP CONSTRAINT IF EXISTS "timeslot_start_time_end_time_days_mask_is_summer_key";
ALTER TABLE "timeslot" DROP CONSTRAINT IF EXISTS "timeslot_start_time_end_time_days_mask_key";

ALTER TABLE "timeslot"
  ADD CONSTRAINT "timeslot_start_time_end_time_days_mask_is_summer_slot_type_key"
  UNIQUE ("start_time", "end_time", "days_mask", "is_summer", "slot_type");

