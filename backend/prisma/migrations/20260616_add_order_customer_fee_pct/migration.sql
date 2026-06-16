-- Migration: add-order-customer-fee-pct
-- Zákaznícky poplatok – feeAmount (existujúci stĺpec) sa reusne, pridáme len audit %.
-- Aditívne, bezpečné: NOT NULL DEFAULT 0 → existujúce objednávky 0.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerFeePct" DECIMAL(5,2) NOT NULL DEFAULT 0;
