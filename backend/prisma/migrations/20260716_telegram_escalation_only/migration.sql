-- Telegram krok 4: filter proti spamu.
-- true = do Telegramu idú len eskalované konverzácie (default = menej spamu).
-- Ukladanie konverzácií to neovplyvňuje – tie sa ukladajú vždy.
ALTER TABLE "TelegramConfig"
  ADD COLUMN IF NOT EXISTS "escalationOnly" BOOLEAN NOT NULL DEFAULT true;
