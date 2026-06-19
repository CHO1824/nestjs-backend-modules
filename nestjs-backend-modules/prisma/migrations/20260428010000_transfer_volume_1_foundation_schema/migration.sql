-- Expand TransactionStatus for the transfer volume-1 state machine.
ALTER TYPE "TransactionStatus" ADD VALUE 'CREATED';
ALTER TYPE "TransactionStatus" ADD VALUE 'QUOTE_CONFIRMED';
ALTER TYPE "TransactionStatus" ADD VALUE 'PAYMENT_RECEIVED';
ALTER TYPE "TransactionStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "TransactionStatus" ADD VALUE 'SENT_TO_PARTNER';
ALTER TYPE "TransactionStatus" ADD VALUE 'REFUNDED';
ALTER TYPE "TransactionStatus" ADD VALUE 'EXPIRED';

-- Align transaction amount precision with the FX/Ledger decimal model.
ALTER TABLE "transactions"
    ALTER COLUMN "send_amount" TYPE DECIMAL(22,6),
    ALTER COLUMN "receive_amount" TYPE DECIMAL(22,6),
    ALTER COLUMN "remittance_fee" TYPE DECIMAL(22,6);

-- A confirmed quote must create at most one transfer. PostgreSQL permits
-- multiple NULL values under a UNIQUE index, so legacy/manual transfers that
-- do not originate from an FX quote remain valid.
DROP INDEX IF EXISTS "transactions_quote_id_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_quote_id_key" ON "transactions"("quote_id");

CREATE TYPE "IdempotencyScope" AS ENUM (
    'CLIENT_API',
    'WEBHOOK_BANK',
    'WEBHOOK_PARTNER',
    'LEDGER',
    'OUTBOX_PARTNER_DISPATCH',
    'ADMIN_ACTION'
);

CREATE TYPE "OutboxStatus" AS ENUM (
    'PENDING',
    'IN_FLIGHT',
    'DELIVERED',
    'DEAD'
);

CREATE TYPE "OutboxEventType" AS ENUM (
    'PARTNER_DISPATCH',
    'BANK_REFUND',
    'NOTIFICATION_PUSH',
    'NOTIFICATION_EMAIL',
    'RECONCILIATION_TRIGGER'
);

CREATE TABLE "transaction_status_logs" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "from_status" "TransactionStatus",
    "to_status" "TransactionStatus" NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_status_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transaction_status_logs_transaction_id_occurred_at_idx"
    ON "transaction_status_logs"("transaction_id", "occurred_at" DESC);
CREATE INDEX "transaction_status_logs_to_status_occurred_at_idx"
    ON "transaction_status_logs"("to_status", "occurred_at" DESC);

-- Audit-grade retention: never cascade-delete with the parent transaction.
-- Use NO ACTION so any transaction removal must explicitly handle its status
-- history (e.g., archive then delete). Cascade would silently destroy the
-- regulatory record-keeping trail required by ADR-010.
ALTER TABLE "transaction_status_logs"
    ADD CONSTRAINT "transaction_status_logs_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "scope" "IdempotencyScope" NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT,
    "response_status" INTEGER,
    "response_body" JSONB,
    "result_ref_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_records_scope_key_key" ON "idempotency_records"("scope", "key");
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" "OutboxEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "next_run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" JSONB,
    "dead_reason" TEXT,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_events_idempotency_key_key" ON "outbox_events"("idempotency_key");
CREATE INDEX "outbox_events_status_next_run_at_idx" ON "outbox_events"("status", "next_run_at");
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");
