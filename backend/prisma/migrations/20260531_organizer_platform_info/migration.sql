-- Migration: organizer-platform-info
-- Adds extended business fields to Organizer + creates PlatformInfo singleton

-- AlterTable Organizer
ALTER TABLE "Organizer"
  ADD COLUMN IF NOT EXISTS "companyName"    TEXT,
  ADD COLUMN IF NOT EXISTS "icDph"          TEXT,
  ADD COLUMN IF NOT EXISTS "vatPayer"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "vatRate"        DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "addressStreet"  TEXT,
  ADD COLUMN IF NOT EXISTS "addressCity"    TEXT,
  ADD COLUMN IF NOT EXISTS "addressZip"     TEXT,
  ADD COLUMN IF NOT EXISTS "addressCountry" TEXT DEFAULT 'SK',
  ADD COLUMN IF NOT EXISTS "bankAccount"    TEXT;

-- CreateTable PlatformInfo
CREATE TABLE IF NOT EXISTS "PlatformInfo" (
  "id"               TEXT NOT NULL,
  "legalName"        TEXT NOT NULL DEFAULT 'TicketAll s.r.o.',
  "ico"              TEXT,
  "icDph"            TEXT,
  "addressStreet"    TEXT,
  "addressCity"      TEXT,
  "addressZip"       TEXT,
  "addressCountry"   TEXT DEFAULT 'SK',
  "defaultVatRateSk" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  "defaultVatRateCz" DECIMAL(5,2) NOT NULL DEFAULT 21.00,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformInfo_pkey" PRIMARY KEY ("id")
);

-- Seed: insert default PlatformInfo singleton if not exists
INSERT INTO "PlatformInfo" ("id", "legalName", "updatedAt", "createdAt")
SELECT gen_random_uuid()::text, 'TicketAll s.r.o.', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "PlatformInfo");

-- Seed: update muckajur's Organizer with placeholder business data
UPDATE "Organizer"
SET
  "companyName"    = 'Test Organizer s.r.o.',
  "ico"            = '12345678',
  "addressStreet"  = 'Testovacia 1',
  "addressCity"    = 'Bratislava',
  "addressZip"     = '81101',
  "addressCountry" = 'SK',
  "vatPayer"       = false
WHERE id = (
  SELECT "organizerId" FROM "User" WHERE email = 'muckajur@gmail.com' LIMIT 1
);
