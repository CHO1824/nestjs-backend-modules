/*
  Warnings:

  - Changed the type of `event_type` on the `notification_events` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "admin_activities" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notification_events" DROP COLUMN "event_type",
ADD COLUMN     "event_type" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "link_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "send_amount" DECIMAL(18,2) NOT NULL,
    "receive_amount" DECIMAL(18,2) NOT NULL,
    "fx_rate" DECIMAL(18,6) NOT NULL,
    "remittance_fee" DECIMAL(18,2) NOT NULL DEFAULT 1,
    "sender_currency" TEXT NOT NULL,
    "sender_country" TEXT NOT NULL,
    "beneficiary_currency" TEXT NOT NULL,
    "beneficiary_country" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_tracking_number_key" ON "transactions"("tracking_number");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notification_events_event_type_idx" ON "notification_events"("event_type");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
