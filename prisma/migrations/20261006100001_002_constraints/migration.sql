-- ---------------------------------------------------------------------------
-- Migration 002: Exclusion constraint and generated time_range
-- From docs/DATA_MODEL.md §3.1 & docs/ARCHITECTURE.md §4.2
-- ---------------------------------------------------------------------------

-- Ensure btree_gist extension exists for GiST indexing on integer + range
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Add generated column time_range
-- MUST be tstzrange, NOT tsrange: tsrange(timestamptz, timestamptz) does not exist in PostgreSQL
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "time_range" tstzrange
  GENERATED ALWAYS AS (tstzrange("slotStart", "slotEnd")) STORED;

-- 2. Add scoped exclusion constraint for capacity-1 bookings
-- resourcesNeeded = 1 predicate is critical: allows multi-seat lab capacity (KT-3b)
ALTER TABLE "Booking" ADD CONSTRAINT "no_host_overlap"
  EXCLUDE USING gist ("hostId" WITH =, "time_range" WITH &&)
  WHERE ("status" <> 'CANCELLED' AND "resourcesNeeded" = 1);
