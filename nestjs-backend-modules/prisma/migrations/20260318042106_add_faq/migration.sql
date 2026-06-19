/*
  Warnings:

  - You are about to drop the `faq_categories` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateTable
CREATE TABLE "faqs" (
    "id" UUID NOT NULL,
    "question" VARCHAR(255) NOT NULL,
    "answer" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_faqs_is_active" ON "faqs"("is_active");

-- CreateIndex
CREATE INDEX "idx_faqs_sort_order" ON "faqs"("sort_order");

-- CreateIndex
CREATE INDEX "idx_faqs_created_at" ON "faqs"("created_at");
