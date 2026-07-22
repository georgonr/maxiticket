-- Migration: helpdesk tickets (krok 27) – dátová vrstva helpdesku.
-- Aditívne, idempotentné. Enumy + tabuľky HelpdeskTicket/HelpdeskMessage + indexy + FK + sekvencia čísel.
-- Conversation a Message sa NEMENIA (väzba je len cez HelpdeskTicket.conversationId).
--
-- POZOR: "Ticket"/"TicketStatus" v tejto DB patria VSTUPENKE. Helpdeskové entity
-- preto nesú prefix Helpdesk*, inak by CREATE TABLE IF NOT EXISTS ticho preskočil
-- existujúcu tabuľku vstupeniek a indexy by sa vytvárali nad ňou.
DO $$ BEGIN CREATE TYPE "HelpdeskStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "HelpdeskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "HelpdeskSource" AS ENUM ('CHAT', 'EMAIL', 'MANUAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "HelpdeskSender" AS ENUM ('CUSTOMER', 'AI', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "HelpdeskTicket" (
  "id" TEXT NOT NULL,
  "ticketNumber" TEXT NOT NULL,
  "subject" TEXT,
  "customerEmail" TEXT NOT NULL,
  "customerName" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'sk',
  "status" "HelpdeskStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "HelpdeskPriority" NOT NULL DEFAULT 'NORMAL',
  "source" "HelpdeskSource" NOT NULL DEFAULT 'CHAT',
  "assignedToId" TEXT,
  "conversationId" TEXT,
  "aiSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "HelpdeskTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HelpdeskMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "sender" "HelpdeskSender" NOT NULL,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "viaEmail" BOOLEAN NOT NULL DEFAULT false,
  "emailMessageId" TEXT,
  "emailInReplyTo" TEXT,
  "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
  "attachmentNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HelpdeskMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HelpdeskTicket_ticketNumber_key" ON "HelpdeskTicket"("ticketNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "HelpdeskTicket_conversationId_key" ON "HelpdeskTicket"("conversationId");
CREATE INDEX IF NOT EXISTS "HelpdeskTicket_status_updatedAt_idx" ON "HelpdeskTicket"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "HelpdeskTicket_customerEmail_idx" ON "HelpdeskTicket"("customerEmail");

CREATE UNIQUE INDEX IF NOT EXISTS "HelpdeskMessage_emailMessageId_key" ON "HelpdeskMessage"("emailMessageId");
CREATE INDEX IF NOT EXISTS "HelpdeskMessage_ticketId_createdAt_idx" ON "HelpdeskMessage"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "HelpdeskMessage_emailInReplyTo_idx" ON "HelpdeskMessage"("emailInReplyTo");

DO $$ BEGIN
  ALTER TABLE "HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "HelpdeskTicket" ADD CONSTRAINT "HelpdeskTicket_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "HelpdeskMessage" ADD CONSTRAINT "HelpdeskMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "HelpdeskTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "HelpdeskMessage" ADD CONSTRAINT "HelpdeskMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Čísla tiketov (HD-00001). Sekvencia, nie count()+1 ako pri orderNumber:
-- po zmazaní riadku by sa číslo recyklovalo a dvaja zákazníci by dostali to isté
-- číslo do e-mailu, čo rozbije aj párovanie odpovedí podľa [HD-…] v predmete.
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;
