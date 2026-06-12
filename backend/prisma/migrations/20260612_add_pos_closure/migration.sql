-- Migration: add-pos-closure
-- 17-B: uzávierka POS pokladne – snapshot súčtov hotovosť/karta za obdobie.
-- Idempotentné (IF NOT EXISTS / DO-block guard). Žiadne existujúce dáta nedotknuté.

CREATE TABLE IF NOT EXISTS "PosClosure" (
  "id"           TEXT NOT NULL,
  "organizerId"  TEXT NOT NULL,
  "closedById"   TEXT NOT NULL,
  "periodFrom"   TIMESTAMP(3) NOT NULL,
  "periodTo"     TIMESTAMP(3) NOT NULL,
  "cashTotal"    DECIMAL(10,2) NOT NULL,
  "cardTotal"    DECIMAL(10,2) NOT NULL,
  "orderCount"   INTEGER NOT NULL,
  "ticketCount"  INTEGER NOT NULL,
  "note"         TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosClosure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PosClosure_organizerId_createdAt_idx"
  ON "PosClosure"("organizerId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PosClosure" ADD CONSTRAINT "PosClosure_organizerId_fkey"
    FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PosClosure" ADD CONSTRAINT "PosClosure_closedById_fkey"
    FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Index na Order.paymentProvider (zrýchli POS summary + 12C provider filter)
CREATE INDEX IF NOT EXISTS "Order_paymentProvider_idx" ON "Order"("paymentProvider");
