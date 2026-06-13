-- Migration: add-seat-maps
-- 22 fáza 1/5: seat-mapy viazané na Venue. SeatMap → Section → Row → Seat.
-- Dva režimy sekcie: SECTIONED (len kapacita) | SEATED (menované sedadlá).
-- Idempotentné a aditívne. Žiadne existujúce dáta/štruktúry nedotknuté.
-- Cascade delete na všetkých úrovniach (zmazanie mapy → sekcie → rady → sedadlá).
--
-- SectionMode je NOVÝ enum → CREATE TYPE (nie ALTER TYPE ADD VALUE), preto sa
-- bezpečne dá vytvoriť v DO bloku s duplicate_object guardom.

-- 1) Enum SectionMode
DO $$ BEGIN
  CREATE TYPE "SectionMode" AS ENUM ('SECTIONED', 'SEATED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Tabuľky
CREATE TABLE IF NOT EXISTS "SeatMap" (
  "id"        TEXT NOT NULL,
  "venueId"   TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeatMap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Section" (
  "id"           TEXT NOT NULL,
  "seatMapId"    TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "mode"         "SectionMode" NOT NULL,
  "capacity"     INTEGER,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "color"        TEXT,
  CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Row" (
  "id"           TEXT NOT NULL,
  "sectionId"    TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Row_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Seat" (
  "id"           TEXT NOT NULL,
  "rowId"        TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "x"            DOUBLE PRECISION,
  "y"            DOUBLE PRECISION,
  "isAccessible" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- 3) Indexy
CREATE INDEX IF NOT EXISTS "SeatMap_venueId_idx" ON "SeatMap"("venueId");
CREATE INDEX IF NOT EXISTS "Section_seatMapId_idx" ON "Section"("seatMapId");
CREATE INDEX IF NOT EXISTS "Row_sectionId_idx" ON "Row"("sectionId");
CREATE INDEX IF NOT EXISTS "Seat_rowId_idx" ON "Seat"("rowId");

-- 4) Foreign keys (cascade delete naprieč hierarchiou)
DO $$ BEGIN
  ALTER TABLE "SeatMap" ADD CONSTRAINT "SeatMap_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Section" ADD CONSTRAINT "Section_seatMapId_fkey"
    FOREIGN KEY ("seatMapId") REFERENCES "SeatMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Row" ADD CONSTRAINT "Row_sectionId_fkey"
    FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Seat" ADD CONSTRAINT "Seat_rowId_fkey"
    FOREIGN KEY ("rowId") REFERENCES "Row"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
