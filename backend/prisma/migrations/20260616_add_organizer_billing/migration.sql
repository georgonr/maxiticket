-- Migration: add-organizer-billing
-- Per-organizátor fakturačná konfigurácia (super-admin only). Aditívne, bezpečné:
-- NOT NULL DEFAULT → existujúci organizátori dostanú defaulty automaticky.
ALTER TABLE "Organizer"
  ADD COLUMN IF NOT EXISTS "commissionPercent"  DECIMAL(5,2) NOT NULL DEFAULT 6.00,
  ADD COLUMN IF NOT EXISTS "vatPercent"         DECIMAL(5,2) NOT NULL DEFAULT 23.00,
  ADD COLUMN IF NOT EXISTS "feesIncluded"       BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "customerFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 1.00;
