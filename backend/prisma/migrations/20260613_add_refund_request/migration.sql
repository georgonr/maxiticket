-- Migration: add-refund-request
-- 20: refund flow – žiadosť o vrátenie, schvaľovanie, zneplatnenie lístkov.
-- Idempotentné a aditívne. Žiadne existujúce dáta nedotknuté.
--
-- POZOR: ALTER TYPE ... ADD VALUE sa NESMIE spúšťať vnútri DO bloku / funkcie
-- ("cannot be executed from a function or multi-command string") ani sa nová
-- hodnota nesmie použiť v tej istej transakcii. Preto sú to samostatné statements
-- s IF NOT EXISTS (idempotencia, PG 10+). RefundRequest.status je TEXT, nie enum,
-- takže nové enum hodnoty sa v tejto migrácii nepoužívajú.

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUND_REQUESTED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUND_APPROVED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUND_REJECTED';

CREATE TABLE IF NOT EXISTS "RefundRequest" (
  "id"            TEXT NOT NULL,
  "orderId"       TEXT NOT NULL,
  "requestedById" TEXT,
  "reason"        TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'REQUESTED',
  "reviewedById"  TEXT,
  "reviewNote"    TEXT,
  "refundAmount"  DECIMAL(10,2),
  "requestedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt"    TIMESTAMP(3),
  "refundedAt"    TIMESTAMP(3),
  CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RefundRequest_orderId_idx" ON "RefundRequest"("orderId");
CREATE INDEX IF NOT EXISTS "RefundRequest_status_idx" ON "RefundRequest"("status");

DO $$ BEGIN
  ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
