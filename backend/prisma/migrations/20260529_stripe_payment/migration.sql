-- Add expiresAt to Order for PENDING order expiry
ALTER TABLE "Order" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Stripe event idempotency log
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);
