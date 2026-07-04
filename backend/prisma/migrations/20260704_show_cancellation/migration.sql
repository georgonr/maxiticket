-- Migration: show-cancellation (event-level cancel + hromadný refund + copy)
-- Aditívne, idempotentné. EventStatus.CANCELLED už existuje – enum sa NEMENÍ.
-- Audit stĺpce zrušenia + žiadosti organizátora o zrušenie na tabuľke "Show".
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT;
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "Show" ADD COLUMN IF NOT EXISTS "cancelRequestedById" TEXT;
