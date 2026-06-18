-- Migration: ekasa-pos (eKasa fiškalizácia POS – krok eKasa-F1, scaffolding)
-- Aditívne: nový enum, nová tabuľka, nové stĺpce. Žiadny existujúci stĺpec sa nemení.

-- EkasaStatus enum (nový typ – hodnoty sú v tej istej transakcii použiteľné).
DO $$ BEGIN
  CREATE TYPE "EkasaStatus" AS ENUM ('NONE','PENDING','REGISTERED','OFFLINE','FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Organizer: DPH sadzba lístka pre eKasa doklad.
ALTER TABLE "Organizer" ADD COLUMN IF NOT EXISTS "ticketVatPercent" INTEGER NOT NULL DEFAULT 23;

-- Order: výsledok eKasa registrácie.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ekasaStatus" "EkasaStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ekasaReceiptId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ekasaOkp" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ekasaPkp" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ekasaReceiptNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ekasaRegisteredAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ekasaError" TEXT;

-- EkasaDevice (konfigurácia ORP per organizátor).
CREATE TABLE IF NOT EXISTS "EkasaDevice" (
  "id" TEXT NOT NULL,
  "organizerId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "cashRegisterCode" TEXT NOT NULL,
  "exposeUrl" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "printMode" TEXT NOT NULL DEFAULT 'pos',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EkasaDevice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EkasaDevice_organizerId_idx" ON "EkasaDevice"("organizerId");

ALTER TABLE "EkasaDevice" ADD CONSTRAINT "EkasaDevice_organizerId_fkey"
  FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
