-- Recreate TerminStatus enum with new values (DRAFT, COMING_SOON, PAST; remove ENDED)

-- 1. Drop default first so the column type change doesn't fail
ALTER TABLE "Termin" ALTER COLUMN "status" DROP DEFAULT;

-- 2. Swap enum type
CREATE TYPE "TerminStatus_new" AS ENUM ('DRAFT', 'COMING_SOON', 'ON_SALE', 'SOLD_OUT', 'CANCELLED', 'PAST');

ALTER TABLE "Termin" ALTER COLUMN "status" TYPE "TerminStatus_new"
  USING "status"::text::"TerminStatus_new";

DROP TYPE "TerminStatus";
ALTER TYPE "TerminStatus_new" RENAME TO "TerminStatus";

-- 3. Restore default with new type
ALTER TABLE "Termin" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"TerminStatus";

-- 4. Add visible column
ALTER TABLE "Termin" ADD COLUMN IF NOT EXISTS "visible" BOOLEAN NOT NULL DEFAULT true;
