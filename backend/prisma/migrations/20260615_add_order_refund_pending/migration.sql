-- Migration: add-order-refund-pending
-- Krok 27: nový OrderStatus REFUND_PENDING (termín zrušený → čaká na manuálny refund).
-- ALTER TYPE ADD VALUE IF NOT EXISTS – idempotentné, aditívne. Žiadny existujúci stĺpec sa nemení.
-- Pozn.: nová hodnota sa pridáva za REFUND_REJECTED (poradie v enume nie je sémanticky dôležité).

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REFUND_PENDING' AFTER 'REFUND_REJECTED';
