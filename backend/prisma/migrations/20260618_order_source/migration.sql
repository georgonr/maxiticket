-- Migration: order-source (QR rýchly nákup – pôvod objednávky pre štatistiku)
-- Aditívne: jeden nullable stĺpec.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "source" TEXT;
