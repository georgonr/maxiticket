-- Migration: stav doručenia lístkov na Order (krok 48, audit B4).
-- Aditívne, nullable/default – bez dopadu na existujúce riadky. Idempotentné.
--
-- Kontext: lístky sa po PAID posielajú best-effort (fire-and-forget). Ak odoslanie
-- zlyhá (PDF ENOENT, SMTP výpadok), objednávka ostane PAID, ale nedalo sa zistiť,
-- že zákazník lístky nedostal. Tieto polia robia stav dohľadateľným:
--   - ticketsEmailedAt    : čas úspešného odoslania (NULL = ešte nedoručené)
--   - ticketsEmailError   : posledná chyba (NULL po úspechu)
--   - ticketsEmailAttempts: počet pokusov; >=1 znamená "pokúsili sme sa".
--
-- SPÄTNÁ KOMPATIBILITA: existujúce PAID objednávky dostanú attempts=0 a
-- ticketsEmailedAt=NULL. Retry cron berie LEN objednávky s attempts>=1 (t. j. tie,
-- ktoré prešli novým doručovacím kódom), takže staré objednávky NEBUDE hromadne
-- preposielať. Nerobíme backfill – 0/NULL je čestný "historicky nevieme".

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ticketsEmailedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ticketsEmailError" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ticketsEmailAttempts" INTEGER NOT NULL DEFAULT 0;

-- Podpora pre retry cron (WHERE status=PAID AND ticketsEmailedAt IS NULL).
CREATE INDEX IF NOT EXISTS "Order_status_ticketsEmailedAt_idx" ON "Order"("status", "ticketsEmailedAt");
