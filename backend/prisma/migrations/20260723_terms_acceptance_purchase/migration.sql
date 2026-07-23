-- Migration: TermsAcceptance – súhlas aj pri nákupe, aj pre hosťa (krok 44).
-- Aditívne + uvoľnenie userId. Idempotentné.
--
-- Doteraz: userId NOT NULL + UNIQUE(termsVersionId,userId) – model „jeden súhlas
-- na používateľa na verziu", vhodný pre REGISTRÁCIU. Nákup potrebuje:
--   - hosťa bez userId  → userId nullable
--   - väzbu na objednávku → orderId
--   - viac súhlasov toho istého usera (viac nákupov)  → pôvodný UNIQUE už nesmie
--     platiť pre nákupné riadky; ostáva LEN pre registráciu (orderId IS NULL)
--     ako PARTIAL unique index.

ALTER TABLE "TermsAcceptance" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "TermsAcceptance" ADD COLUMN IF NOT EXISTS "orderId" TEXT;

-- pôvodný full unique zruš; registračnú jednorazovosť vynúť partial unikátom
ALTER TABLE "TermsAcceptance" DROP CONSTRAINT IF EXISTS "TermsAcceptance_termsVersionId_userId_key";
DROP INDEX IF EXISTS "TermsAcceptance_termsVersionId_userId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "TermsAcceptance_reg_unique"
  ON "TermsAcceptance"("termsVersionId","userId") WHERE "orderId" IS NULL;

CREATE INDEX IF NOT EXISTS "TermsAcceptance_orderId_idx" ON "TermsAcceptance"("orderId");

-- väzba na objednávku (nákupný súhlas); CASCADE – súhlas žije s objednávkou.
DO $$ BEGIN
  ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
