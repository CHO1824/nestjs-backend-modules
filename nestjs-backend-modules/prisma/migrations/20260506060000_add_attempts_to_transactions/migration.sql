-- Adds the `attempts` column declared in prisma/schema/transaction.prisma:54.
-- The Prisma model has carried this field since the volume-1 transfer work
-- (PR #98), but no DDL migration was emitted alongside it. Result:
-- `tx.transaction.create({...})` in QuoteRepository.confirmQuoteAtomic
-- failed with `column "attempts" does not exist` on every fresh DB.
--
-- See issue #100. `IF NOT EXISTS` keeps this idempotent for environments
-- that ran the manual ALTER as an incident workaround.

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
