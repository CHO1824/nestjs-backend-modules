-- Partner-submitter concurrency + retry hardening.

-- 1. Dedicated submit-phase retry counter, independent of `attempts` (owned by
--    the dispatcher for the PAYMENT_RECEIVED phase). Bounds re-dispatch of a row
--    whose post-dispatch step keeps failing.
ALTER TABLE "transactions" ADD COLUMN "submit_attempts" INTEGER NOT NULL DEFAULT 0;

-- 2. Lease marker. A worker stamps claimed_at before the (non-transactional)
--    partner HTTP call so a second worker cannot dispatch the same PROCESSING
--    row concurrently. NULL = unclaimed; a value older than the lease window is
--    reclaimable (crash recovery).
ALTER TABLE "transactions" ADD COLUMN "claimed_at" TIMESTAMPTZ(3);

-- 3. Index for the submitter candidate scan (status + claim state).
CREATE INDEX "transactions_status_claimed_at_idx" ON "transactions" ("status", "claimed_at");
