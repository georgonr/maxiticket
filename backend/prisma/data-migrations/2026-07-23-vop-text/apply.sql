-- Vloženie VOP do TermsVersion (krok 43, variant B – dva samostatné dokumenty).
-- Obsah sa načíta z .md súborov cez \set (žiadna shell interpolácia); :'var'
-- psql sám bezpečne zaescapuje (apostrofy v slovenčine, $, backticky).
\set buyer `cat /tmp/vop-kupujuci.md`
\set org   `cat /tmp/vop-organizatori.md`
BEGIN;
INSERT INTO "TermsVersion" (id,"organizerId",type,version,content,"publishedAt","isActive")
SELECT gen_random_uuid()::text, NULL, 'BUYER_PURCHASE', '1.0', :'buyer', '2026-01-01T00:00:00Z', true
WHERE NOT EXISTS (SELECT 1 FROM "TermsVersion" WHERE type='BUYER_PURCHASE' AND "organizerId" IS NULL AND "isActive"=true);
INSERT INTO "TermsVersion" (id,"organizerId",type,version,content,"publishedAt","isActive")
SELECT gen_random_uuid()::text, NULL, 'ORGANIZER_REGISTRATION', '1.0', :'org', '2026-01-01T00:00:00Z', true
WHERE NOT EXISTS (SELECT 1 FROM "TermsVersion" WHERE type='ORGANIZER_REGISTRATION' AND "organizerId" IS NULL AND "isActive"=true);
UPDATE "TermsVersion" SET content=:'buyer' WHERE type='BUYER_PURCHASE'        AND "organizerId" IS NULL AND "isActive"=true;
UPDATE "TermsVersion" SET content=:'org'   WHERE type='ORGANIZER_REGISTRATION' AND "organizerId" IS NULL AND "isActive"=true;
SELECT type, "isActive", length(content) AS chars, "publishedAt" FROM "TermsVersion" WHERE "organizerId" IS NULL ORDER BY type;
COMMIT;
