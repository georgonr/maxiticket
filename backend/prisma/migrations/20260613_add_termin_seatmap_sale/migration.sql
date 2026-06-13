-- Migration: add-termin-seatmap-sale
-- 22 fáza 3a/5: napojenie seat-máp na predaj (SECTIONED).
-- Termin.mode GENERAL/SEATMAP + väzba na SeatMap; TerminSection (cena per sekcia per termín);
-- OrderItem.terminSectionId a Ticket.terminSectionId (SECTIONED položky/lístky).
-- Ticket.ticketTypeId sa uvoľňuje na NULLABLE (SECTIONED lístok nemá TicketType).
-- Idempotentné a aditívne. GENERAL stĺpce a existujúce dáta nedotknuté.
--
-- TerminMode je NOVÝ enum → CREATE TYPE v DO bloku s duplicate_object guardom.

-- 1) Enum TerminMode
DO $$ BEGIN
  CREATE TYPE "TerminMode" AS ENUM ('GENERAL', 'SEATMAP');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Termin: mode + väzba na SeatMap
ALTER TABLE "Termin" ADD COLUMN IF NOT EXISTS "mode" "TerminMode" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Termin" ADD COLUMN IF NOT EXISTS "seatMapId" TEXT;

-- 3) TerminSection (cena + currency per sekcia per termín)
CREATE TABLE IF NOT EXISTS "TerminSection" (
  "id"        TEXT NOT NULL,
  "terminId"  TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "price"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  "currency"  TEXT NOT NULL DEFAULT 'EUR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TerminSection_pkey" PRIMARY KEY ("id")
);

-- 4) OrderItem.terminSectionId (SECTIONED položka – alternatíva k ticketTypeId)
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "terminSectionId" TEXT;

-- 5) Ticket: uvoľnenie ticketTypeId na NULL + terminSectionId
ALTER TABLE "Ticket" ALTER COLUMN "ticketTypeId" DROP NOT NULL;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "terminSectionId" TEXT;

-- 6) Indexy
CREATE UNIQUE INDEX IF NOT EXISTS "TerminSection_terminId_sectionId_key" ON "TerminSection"("terminId", "sectionId");
CREATE INDEX IF NOT EXISTS "TerminSection_terminId_idx" ON "TerminSection"("terminId");
CREATE INDEX IF NOT EXISTS "TerminSection_sectionId_idx" ON "TerminSection"("sectionId");
CREATE INDEX IF NOT EXISTS "OrderItem_terminSectionId_idx" ON "OrderItem"("terminSectionId");

-- 7) Foreign keys
DO $$ BEGIN
  ALTER TABLE "Termin" ADD CONSTRAINT "Termin_seatMapId_fkey"
    FOREIGN KEY ("seatMapId") REFERENCES "SeatMap"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminSection" ADD CONSTRAINT "TerminSection_terminId_fkey"
    FOREIGN KEY ("terminId") REFERENCES "Termin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminSection" ADD CONSTRAINT "TerminSection_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_terminSectionId_fkey"
    FOREIGN KEY ("terminSectionId") REFERENCES "TerminSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_terminSectionId_fkey"
    FOREIGN KEY ("terminSectionId") REFERENCES "TerminSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
