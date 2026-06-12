-- Migration: add-venue-global-isactive
-- 16-A: globálne (zdieľané) miesta konania + soft-delete.
--  1. Venue.organizerId → nullable (null = globálne miesto viditeľné všetkým organizátorom)
--  2. Venue.isActive Boolean default true (soft delete pri naviazaných termínoch)
--  3. index na city (vyhľadávanie/filter)
-- Idempotentné. Existujúce venues majú organizerId vyplnené → ostávajú organizer-scoped.

ALTER TABLE "Venue" ALTER COLUMN "organizerId" DROP NOT NULL;

ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Venue_city_idx" ON "Venue"("city");
