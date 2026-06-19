/*
  Warnings:

  - A unique constraint covering the columns `[external_id]` on the table `notification_deliveries` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationChannel" ADD VALUE 'SMS';
ALTER TYPE "NotificationChannel" ADD VALUE 'KAKAO';

-- AlterTable
ALTER TABLE "notification_deliveries" ADD COLUMN     "cost" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "provider" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_external_id_key" ON "notification_deliveries"("external_id");
