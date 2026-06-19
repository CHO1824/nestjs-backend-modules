/*
  Warnings:

  - The values [success,failed] on the enum `KycStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('KYC_STATUS_CHANGED', 'TRANSACTION_STATUS_CHANGED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "KycStatus_new" AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'error', 'expired');
ALTER TABLE "public"."user_country_kyc" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "user_country_kyc" ALTER COLUMN "status" TYPE "KycStatus_new" USING ("status"::text::"KycStatus_new");
ALTER TYPE "KycStatus" RENAME TO "KycStatus_old";
ALTER TYPE "KycStatus_new" RENAME TO "KycStatus";
DROP TYPE "public"."KycStatus_old";
ALTER TABLE "user_country_kyc" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;

-- CreateTable
CREATE TABLE "notification_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" "NotificationEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationEventStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "template_code" TEXT NOT NULL,
    "rendered_title" TEXT,
    "rendered_body" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "failure_reason" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_events_user_id_idx" ON "notification_events"("user_id");

-- CreateIndex
CREATE INDEX "notification_events_event_type_idx" ON "notification_events"("event_type");

-- CreateIndex
CREATE INDEX "notification_events_status_idx" ON "notification_events"("status");

-- CreateIndex
CREATE INDEX "notification_deliveries_event_id_idx" ON "notification_deliveries"("event_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_channel_status_idx" ON "notification_deliveries"("channel", "status");

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "notification_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
