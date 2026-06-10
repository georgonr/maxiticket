-- Migration: add-coupons
-- Pridáva zľavové kupóny: enumy CouponType/CouponScope, modely Coupon + CouponRedemption,
-- a pole Order.discountAmount. Idempotentné (IF NOT EXISTS / DO-block guards).

-- ─── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_TICKET');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CouponScope" AS ENUM ('GLOBAL', 'ORGANIZER', 'SHOW', 'TICKET_TYPE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── Order.discountAmount ────────────────────────────────────────────────────
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- ─── Coupon ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Coupon" (
  "id"             TEXT NOT NULL,
  "code"           TEXT NOT NULL,
  "type"           "CouponType" NOT NULL,
  "value"          DECIMAL(10,2) NOT NULL,
  "scope"          "CouponScope" NOT NULL,
  "organizerId"    TEXT,
  "showId"         TEXT,
  "ticketTypeId"   TEXT,
  "validFrom"      TIMESTAMP(3),
  "validUntil"     TIMESTAMP(3),
  "maxUses"        INTEGER,
  "maxUsesPerUser" INTEGER,
  "minOrderAmount" DECIMAL(10,2),
  "usedCount"      INTEGER NOT NULL DEFAULT 0,
  "createdById"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bulkBatchId"    TEXT,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_code_idx" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_scope_organizerId_idx" ON "Coupon"("scope", "organizerId");
CREATE INDEX IF NOT EXISTS "Coupon_showId_idx" ON "Coupon"("showId");
CREATE INDEX IF NOT EXISTS "Coupon_bulkBatchId_idx" ON "Coupon"("bulkBatchId");

-- ─── CouponRedemption ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CouponRedemption" (
  "id"             TEXT NOT NULL,
  "couponId"       TEXT NOT NULL,
  "orderId"        TEXT NOT NULL,
  "userId"         TEXT,
  "discountAmount" DECIMAL(10,2) NOT NULL,
  "redeemedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");

-- ─── Foreign keys (guarded – ADD CONSTRAINT nemá IF NOT EXISTS) ───────────────
DO $$ BEGIN
  ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_organizerId_fkey"
    FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_showId_fkey"
    FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_ticketTypeId_fkey"
    FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
