-- Migration: add-payment-gateway
-- Úloha 25: aktívna platobná brána (singleton). Default STRIPE_LIVE = dnešné správanie.
-- Aditívne a idempotentné. Žiadny existujúci stĺpec/tabuľka sa nemení.
--
-- PaymentGateway je NOVÝ enum → CREATE TYPE v DO bloku s duplicate_object guardom.

-- 1) Enum PaymentGateway
DO $$ BEGIN
  CREATE TYPE "PaymentGateway" AS ENUM ('STRIPE_SANDBOX', 'STRIPE_LIVE', 'COMGATE_TEST', 'COMGATE_LIVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Singleton tabuľka PaymentGatewayConfig
CREATE TABLE IF NOT EXISTS "PaymentGatewayConfig" (
  "id"            TEXT NOT NULL,
  "activeGateway" "PaymentGateway" NOT NULL DEFAULT 'STRIPE_LIVE',
  "updatedById"   TEXT,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentGatewayConfig_pkey" PRIMARY KEY ("id")
);
