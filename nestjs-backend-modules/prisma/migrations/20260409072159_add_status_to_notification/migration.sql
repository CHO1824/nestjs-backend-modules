-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trace_id" UUID,
    "channel" VARCHAR(20) NOT NULL,
    "template_id" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "priority" SMALLINT NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "error_log" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_outbox_status_next_retry_at_priority_idx" ON "notification_outbox"("status", "next_retry_at", "priority");
