-- CreateTable
CREATE TABLE "notification_message_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" VARCHAR(100) NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_message_templates_event_type_locale_key" ON "notification_message_templates"("event_type", "locale");
