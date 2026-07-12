-- Migration: order-card-last4 (AI guest identity verification – fáza 1)
-- Aditívne, idempotentné. Nullable stĺpec: posledné 4 čísla platobnej karty,
-- zachytené best-effort pri Stripe webhooku (checkout.session.completed).
-- Pre nekartové platby (mock/comp/POS) ostáva NULL.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cardLast4" TEXT;
