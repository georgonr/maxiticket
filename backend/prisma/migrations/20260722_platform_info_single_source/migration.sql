-- Migration: platform info single source (krok 30).
-- Aditívne + uvoľnenie legalName. Idempotentné.
--
-- Kontext: firemné údaje boli na dvoch miestach – faktúry ich brali z ENV
-- PLATFORM_*, vstupenky a doklady z tejto tabuľky, a každá vetva mala iný
-- hardcode fallback. Táto tabuľka sa stáva jediným zdrojom, ENV sa ruší.

-- Nové polia: DIČ, zápis v OR, IBAN a kontakt (doteraz nikde neevidované).
ALTER TABLE "PlatformInfo" ADD COLUMN IF NOT EXISTS "dic" TEXT;
ALTER TABLE "PlatformInfo" ADD COLUMN IF NOT EXISTS "registrationNote" TEXT;
ALTER TABLE "PlatformInfo" ADD COLUMN IF NOT EXISTS "iban" TEXT;
ALTER TABLE "PlatformInfo" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "PlatformInfo" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;

-- legalName: preč s defaultom aj NOT NULL. Chýbajúci údaj sa má na doklade
-- vynechať, nie nahradiť vymysleným menom ("TicketAll s.r.o.").
ALTER TABLE "PlatformInfo" ALTER COLUMN "legalName" DROP DEFAULT;
ALTER TABLE "PlatformInfo" ALTER COLUMN "legalName" DROP NOT NULL;

-- SK základná sadzba DPH je od 1. 1. 2025 23 %.
ALTER TABLE "PlatformInfo" ALTER COLUMN "defaultVatRateSk" SET DEFAULT 23.00;
