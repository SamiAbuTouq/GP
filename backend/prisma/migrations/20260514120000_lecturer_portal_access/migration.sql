-- Lecturers without portal access exist for scheduling only (no login, no welcome email).
ALTER TABLE "lecturer" ADD COLUMN "portal_access_enabled" BOOLEAN NOT NULL DEFAULT true;
