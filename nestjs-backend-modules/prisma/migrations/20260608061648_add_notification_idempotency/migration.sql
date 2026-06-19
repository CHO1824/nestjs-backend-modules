-- CreateTable
CREATE TABLE "notification_idempotency" (
    "id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_idempotency_idempotency_key_key" ON "notification_idempotency"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_idempotency_created_at_idx" ON "notification_idempotency"("created_at");
