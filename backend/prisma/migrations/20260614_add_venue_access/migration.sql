-- Migration: add-venue-access
-- Úloha 24: explicitné sprístupnenie miesta organizátorovi (VenueAccess).
-- Organizer vidí vlastné + sprístupnené; globálne (organizerId=null) už nie sú
-- auto-viditeľné – iba ak ich SUPERADMIN sprístupní.
-- Aditívne a idempotentné. Žiadny data backfill, existujúce venues nedotknuté.

-- 1) Tabuľka VenueAccess
CREATE TABLE IF NOT EXISTS "VenueAccess" (
  "id"          TEXT NOT NULL,
  "venueId"     TEXT NOT NULL,
  "organizerId" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueAccess_pkey" PRIMARY KEY ("id")
);

-- 2) Indexy
CREATE UNIQUE INDEX IF NOT EXISTS "VenueAccess_venueId_organizerId_key" ON "VenueAccess"("venueId", "organizerId");
CREATE INDEX IF NOT EXISTS "VenueAccess_organizerId_idx" ON "VenueAccess"("organizerId");

-- 3) Foreign keys (Venue CASCADE, Organizer CASCADE)
DO $$ BEGIN
  ALTER TABLE "VenueAccess" ADD CONSTRAINT "VenueAccess_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "VenueAccess" ADD CONSTRAINT "VenueAccess_organizerId_fkey"
    FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
