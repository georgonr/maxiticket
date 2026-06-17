-- Migration: add-invoices (fakturačný systém krok 13b)
-- Nové entity (aditívne, žiadny existujúci stĺpec sa nemení).
DO $$ BEGIN CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT','FINALIZED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "InvoiceLineType" AS ENUM ('COMMISSION','REFUND_FEE','CUSTOM'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT NOT NULL,
  "organizerId" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "invoiceNumber" TEXT,
  "billingMode" "BillingMode" NOT NULL,
  "terminId" TEXT,
  "periodFrom" TIMESTAMP(3),
  "periodTo" TIMESTAMP(3),
  "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "taxDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "buyerName" TEXT, "buyerCompany" TEXT, "buyerIco" TEXT, "buyerDic" TEXT,
  "buyerIcDph" TEXT, "buyerAddress" TEXT, "buyerIban" TEXT,
  "subtotalCents" INTEGER NOT NULL DEFAULT 0,
  "vatTotalCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "snapTicketsSold" INTEGER NOT NULL DEFAULT 0,
  "snapRevenueCents" INTEGER NOT NULL DEFAULT 0,
  "snapRefundedTickets" INTEGER NOT NULL DEFAULT 0,
  "snapNetPayoutCents" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "Invoice_organizerId_idx" ON "Invoice"("organizerId");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");

CREATE TABLE IF NOT EXISTS "InvoiceLineItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "type" "InvoiceLineType" NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPriceCents" INTEGER NOT NULL,
  "vatPercent" DECIMAL(5,2) NOT NULL,
  "lineNetCents" INTEGER NOT NULL,
  "lineVatCents" INTEGER NOT NULL,
  "lineTotalCents" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InvoiceLineItem_invoiceId_idx" ON "InvoiceLineItem"("invoiceId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizerId_fkey"
  FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
