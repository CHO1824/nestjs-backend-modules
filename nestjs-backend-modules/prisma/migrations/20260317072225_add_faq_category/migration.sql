/*
  Warnings:

  - The values [success,failed] on the enum `KycStatus` will be removed. If these variants are still used in the database, this will fail.

*/
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
CREATE TABLE "faq_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faq_categories_created_at_idx" ON "faq_categories"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "faq_categories_name_key" ON "faq_categories"("name");
