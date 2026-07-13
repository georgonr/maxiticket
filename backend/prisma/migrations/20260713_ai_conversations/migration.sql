-- Migration: ai-conversations (krok AI-KONV-1) – perzistencia AI chat konverzácií.
-- Aditívne, idempotentné. Enumy + tabuľky Conversation/Message + indexy + FK.
DO $$ BEGIN CREATE TYPE "ConversationChannel" AS ENUM ('GUEST', 'CUSTOMER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Conversation" (
  "id" TEXT NOT NULL,
  "channel" "ConversationChannel" NOT NULL,
  "sessionKey" TEXT NOT NULL,
  "userId" TEXT,
  "locale" TEXT NOT NULL,
  "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
  "summary" TEXT,
  "escalated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Conversation_status_lastMessageAt_idx" ON "Conversation"("status", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "Conversation_sessionKey_idx" ON "Conversation"("sessionKey");
CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");

DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
