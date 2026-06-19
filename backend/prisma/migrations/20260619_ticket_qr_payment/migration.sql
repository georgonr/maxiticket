-- Migration: ticket-qr-payment (QR v2 – master prepínač QR rýchleho nákupu per GA typ lístka)
-- Aditívne: jeden nullable-free boolean stĺpec s defaultom false.
ALTER TABLE "TicketType" ADD COLUMN IF NOT EXISTS "qrPaymentEnabled" BOOLEAN NOT NULL DEFAULT false;
