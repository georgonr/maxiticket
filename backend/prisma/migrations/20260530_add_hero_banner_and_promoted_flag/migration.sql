-- AddColumn isPromoted to Show
ALTER TABLE "Show" ADD COLUMN "isPromoted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex for isPromoted
CREATE INDEX "Show_isPromoted_idx" ON "Show"("isPromoted");

-- CreateTable HeroBanner
CREATE TABLE "HeroBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activeFrom" TIMESTAMP(3),
    "activeUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for HeroBanner
CREATE INDEX "HeroBanner_isActive_sortOrder_idx" ON "HeroBanner"("isActive", "sortOrder");
