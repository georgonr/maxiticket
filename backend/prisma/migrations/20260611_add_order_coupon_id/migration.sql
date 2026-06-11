-- Migration: add-order-coupon-id
-- Pridáva Order.couponId (nullable FK na Coupon) – aplikovaný kupón na objednávke.
-- Idempotentné (IF NOT EXISTS / DO-block guard).

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponId" TEXT;

CREATE INDEX IF NOT EXISTS "Order_couponId_idx" ON "Order"("couponId");

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
