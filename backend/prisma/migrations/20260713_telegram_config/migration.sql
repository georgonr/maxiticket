-- Migration: telegram-config (krok AI-KONV-2) – singleton config pre Telegram notifikácie.
-- Token NIE je v DB (je v .env); tu len chatId + enabled toggle. Aditívne, idempotentné.
CREATE TABLE IF NOT EXISTS "TelegramConfig" (
  "id" TEXT NOT NULL,
  "chatId" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramConfig_pkey" PRIMARY KEY ("id")
);
