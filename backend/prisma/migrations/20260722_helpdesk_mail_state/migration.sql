-- Migration: helpdesk mail state (krok 29) – UID kurzor IMAP pollera.
-- Aditívne, idempotentné. Bez FK, bez väzieb na existujúce tabuľky.
--
-- Schránka sa NEMENÍ (read-only, žiadne MOVE/DELETE/\Seen), takže jediné, čo
-- drží pozíciu, je lastUid. uidValidity je BIGINT – IMAP UIDVALIDITY je 32-bit
-- unsigned a do INT sa nezmestí.
CREATE TABLE IF NOT EXISTS "HelpdeskMailState" (
  "mailbox" TEXT NOT NULL,
  "lastUid" INTEGER NOT NULL DEFAULT 0,
  "uidValidity" BIGINT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HelpdeskMailState_pkey" PRIMARY KEY ("mailbox")
);
