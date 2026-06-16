-- Migration: add-organizer-billing-mode (fakturačný systém krok 13a)
-- Aditívne: enum BillingMode + 2 stĺpce. Existujúci organizátori → PER_EVENT, refund override NULL.
DO $$ BEGIN
  CREATE TYPE "BillingMode" AS ENUM ('PER_EVENT', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Organizer"
  ADD COLUMN IF NOT EXISTS "billingMode" "BillingMode" NOT NULL DEFAULT 'PER_EVENT',
  ADD COLUMN IF NOT EXISTS "refundFeePerTicketCents" INTEGER;
