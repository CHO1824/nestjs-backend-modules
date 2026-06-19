-- Use the new volume-1 lifecycle default after the enum-value migration has committed.
ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'CREATED';
