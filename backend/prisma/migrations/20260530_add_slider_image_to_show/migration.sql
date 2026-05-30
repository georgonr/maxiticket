-- Add nullable sliderImageId FK on Show → ShowImage (ON DELETE SET NULL)
ALTER TABLE "Show" ADD COLUMN "sliderImageId" TEXT;

ALTER TABLE "Show"
  ADD CONSTRAINT "Show_sliderImageId_fkey"
  FOREIGN KEY ("sliderImageId")
  REFERENCES "ShowImage"("id")
  ON DELETE SET NULL;

CREATE INDEX "Show_sliderImageId_idx" ON "Show"("sliderImageId");
