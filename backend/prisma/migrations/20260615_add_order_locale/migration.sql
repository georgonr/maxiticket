-- Migration: add-order-locale
-- Krok 31e1: jazyk kupujúceho na objednávke (sk/en/cs) pre lokalizované e-maily.
-- Aditívne a bezpečné: NOT NULL DEFAULT 'sk' → existujúce objednávky dostanú 'sk'
-- automaticky, žiadny iný stĺpec sa nemení.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'sk';
