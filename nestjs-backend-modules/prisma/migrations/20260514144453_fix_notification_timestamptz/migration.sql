-- AlterTable
ALTER TABLE "admin_activities" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "admins" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "banks" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "beneficiaries" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "corridors" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "countries" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "country_currencies" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "country_kyc_methods" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "currencies" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "faq_categories" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "faqs" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "fx_market_rates" ALTER COLUMN "effective_from" SET DEFAULT now(),
ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "fx_policies" ALTER COLUMN "requested_at" SET DEFAULT now(),
ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "idempotency_records" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "journals" ALTER COLUMN "occurred_at" SET DEFAULT now(),
ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "kyc_methods" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "ledger_entries" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "notification_deliveries" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "notification_events" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "notification_outbox" ALTER COLUMN "next_retry_at" SET DEFAULT now(),
ALTER COLUMN "locked_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "created_at" SET DEFAULT now(),
ALTER COLUMN "sent_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DEFAULT now(),
ALTER COLUMN "updated_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "outbox_events" ALTER COLUMN "next_run_at" SET DEFAULT now(),
ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "prefunding_account_logs" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "prefunding_bank_accounts" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "quote_confirm_idempotency" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "quotes" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "social_accounts" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "stored_files" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "transaction_status_logs" ALTER COLUMN "occurred_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "user_country_kyc" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "user_devices" ALTER COLUMN "created_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();
