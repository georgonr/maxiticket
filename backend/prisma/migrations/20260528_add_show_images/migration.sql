-- CreateTable ShowImage
CREATE TABLE "ShowImage" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "squareUrl" TEXT NOT NULL,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShowImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowImage_showId_idx" ON "ShowImage"("showId");
CREATE INDEX "ShowImage_showId_isCover_idx" ON "ShowImage"("showId", "isCover");

-- AddForeignKey
ALTER TABLE "ShowImage" ADD CONSTRAINT "ShowImage_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing posterUrl → ShowImage with isCover = true
INSERT INTO "ShowImage" (id, "showId", url, "thumbUrl", "squareUrl", "isCover", "sortOrder", "createdAt", "updatedAt")
SELECT
    'c' || encode(gen_random_bytes(12), 'hex'),
    id,
    "posterUrl",
    "posterUrl",
    "posterUrl",
    true,
    0,
    NOW(),
    NOW()
FROM "Show"
WHERE "posterUrl" IS NOT NULL;

-- AlterTable Show: drop posterUrl and bannerUrl
ALTER TABLE "Show" DROP COLUMN IF EXISTS "posterUrl";
ALTER TABLE "Show" DROP COLUMN IF EXISTS "bannerUrl";
