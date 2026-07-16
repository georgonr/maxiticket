-- Migration: user-management krok A – nové platformové role.
-- Pridáva hodnoty do natívneho pg enumu "UserRole".
-- POZOR: ALTER TYPE ... ADD VALUE sa nesmie použiť v tej istej transakcii, kde sa
-- hodnota hneď používa. Preto sú príkazy samostatné a idempotentné (IF NOT EXISTS),
-- spúšťané mimo veľkej transakcie (psql autocommit).
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';
