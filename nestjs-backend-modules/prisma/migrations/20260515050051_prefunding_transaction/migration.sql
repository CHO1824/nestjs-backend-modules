-- CreateEnum
CREATE TYPE "prefunding_transaction_type" AS ENUM ('TRANSFER_DEPOSIT', 'TRANSFER_PAYOUT', 'INTERNAL_TOP_UP', 'INTERNAL_WITHDRAW', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "prefunding_direction" AS ENUM ('IN', 'OUT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PrefundingLogType" ADD VALUE 'TRANSFER_DEPOSIT';
ALTER TYPE "PrefundingLogType" ADD VALUE 'TRANSFER_PAYOUT';

-- CreateTable
CREATE TABLE "prefunding_transactions" (
    "id" UUID NOT NULL,
    "original_transaction_id" UUID,
    "type" "prefunding_transaction_type" NOT NULL,
    "direction" "prefunding_direction" NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT "prefunding_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prefunding_transactions_original_transaction_id_idx" ON "prefunding_transactions"("original_transaction_id");

-- CreateIndex
CREATE INDEX "prefunding_transactions_bank_account_id_created_at_idx" ON "prefunding_transactions"("bank_account_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "prefunding_account_logs_prefunding_transaction_id_idx" ON "prefunding_account_logs"("prefunding_transaction_id");

-- AddForeignKey
ALTER TABLE "prefunding_account_logs" ADD CONSTRAINT "prefunding_account_logs_prefunding_transaction_id_fkey" FOREIGN KEY ("prefunding_transaction_id") REFERENCES "prefunding_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prefunding_transactions" ADD CONSTRAINT "prefunding_transactions_original_transaction_id_fkey" FOREIGN KEY ("original_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prefunding_transactions" ADD CONSTRAINT "prefunding_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "prefunding_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
