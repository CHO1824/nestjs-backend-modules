/*
  Warnings:

  - Added the required column `expires_at` to the `notification_idempotency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `request_hash` to the `notification_idempotency` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "notification_idempotency_created_at_idx";

-- AlterTable
ALTER TABLE "notification_idempotency" ADD COLUMN     "expires_at" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "request_hash" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "notification_idempotency_expires_at_idx" ON "notification_idempotency"("expires_at");
