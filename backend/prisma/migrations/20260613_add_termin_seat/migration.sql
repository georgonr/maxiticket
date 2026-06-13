-- Migration: add-termin-seat
-- 22 fáza 3b/5: SEATED predaj – obsadenosť konkrétneho sedadla per termín + atomický lock.
-- TerminSeat (status AVAILABLE/HELD/SOLD, @@unique[terminId,seatId]) + Ticket.seatId.
-- Idempotentné a aditívne. GENERAL/SECTIONED stĺpce a existujúce dáta nedotknuté.
--
-- SeatStatus je NOVÝ enum → CREATE TYPE v DO bloku s duplicate_object guardom.

-- 1) Enum SeatStatus
DO $$ BEGIN
  CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'SOLD');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) TerminSeat
CREATE TABLE IF NOT EXISTS "TerminSeat" (
  "id"          TEXT NOT NULL,
  "terminId"    TEXT NOT NULL,
  "seatId"      TEXT NOT NULL,
  "status"      "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
  "orderId"     TEXT,
  "orderItemId" TEXT,
  "heldAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TerminSeat_pkey" PRIMARY KEY ("id")
);

-- 3) Ticket.seatId
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "seatId" TEXT;

-- 4) Indexy
CREATE UNIQUE INDEX IF NOT EXISTS "TerminSeat_terminId_seatId_key" ON "TerminSeat"("terminId", "seatId");
CREATE INDEX IF NOT EXISTS "TerminSeat_orderId_idx" ON "TerminSeat"("orderId");
CREATE INDEX IF NOT EXISTS "TerminSeat_terminId_status_idx" ON "TerminSeat"("terminId", "status");
CREATE INDEX IF NOT EXISTS "Ticket_seatId_idx" ON "Ticket"("seatId");

-- 5) Foreign keys
DO $$ BEGIN
  ALTER TABLE "TerminSeat" ADD CONSTRAINT "TerminSeat_terminId_fkey"
    FOREIGN KEY ("terminId") REFERENCES "Termin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminSeat" ADD CONSTRAINT "TerminSeat_seatId_fkey"
    FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TerminSeat" ADD CONSTRAINT "TerminSeat_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_seatId_fkey"
    FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
