-- AlterEnum: add WRONG_TERMIN and REFUNDED to ScanResult
-- ALTER TYPE ADD VALUE is non-transactional in PostgreSQL and safe to run outside a transaction block.
ALTER TYPE "ScanResult" ADD VALUE IF NOT EXISTS 'WRONG_TERMIN';
ALTER TYPE "ScanResult" ADD VALUE IF NOT EXISTS 'REFUNDED';
