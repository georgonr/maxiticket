-- Migration: add-user-marketing-optin
-- 19: marketingové novinky opt-in (transakčné maily nemajú toggle). Idempotentné, aditívne.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;
