-- Seed: platformové obchodné podmienky (krok 42).
-- POZOR: content je PLACEHOLDER – finálny text VOP (Sonal, SK legislatíva) sa
-- doplní ručne pred spustením (viď REPORT kroku 42, ako dodať text).
-- Podmienka: organizerId = NULL (platformové) – presne to, čo hľadá auth.service
-- pri registrácii (type + isActive + organizerId IS NULL).
--
-- Idempotentné: nevloží druhý aktívny platformový riadok toho istého typu.
-- Spusti cez: docker compose --env-file /opt/maxiticket/.env exec -T postgres ...
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /tmp/terms_seed.sql

INSERT INTO "TermsVersion" (id, "organizerId", type, version, content, "publishedAt", "isActive")
SELECT gen_random_uuid()::text, NULL, 'BUYER_PURCHASE', '1.0',
       'PLACEHOLDER – finálne znenie VOP pre kupujúcich sem doplní prevádzkovateľ.',
       '2026-01-01T00:00:00Z', true
WHERE NOT EXISTS (
  SELECT 1 FROM "TermsVersion"
  WHERE type = 'BUYER_PURCHASE' AND "organizerId" IS NULL AND "isActive" = true
);

INSERT INTO "TermsVersion" (id, "organizerId", type, version, content, "publishedAt", "isActive")
SELECT gen_random_uuid()::text, NULL, 'ORGANIZER_REGISTRATION', '1.0',
       'PLACEHOLDER – finálne znenie VOP pre organizátorov sem doplní prevádzkovateľ.',
       '2026-01-01T00:00:00Z', true
WHERE NOT EXISTS (
  SELECT 1 FROM "TermsVersion"
  WHERE type = 'ORGANIZER_REGISTRATION' AND "organizerId" IS NULL AND "isActive" = true
);
