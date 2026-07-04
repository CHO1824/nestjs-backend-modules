import { Logger, Module, OnModuleInit } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import * as admin from "firebase-admin";

// Common/External Modules
import { PrismaModule } from "@/common/prisma/prisma.module";
import { NotificationPolicyService } from "@/modules/notification/services/notification-policy.service";

import { UserModule } from "../user/user.module";
// Guards
import { InternalApiKeyGuard } from "./guards/internal-api-key.guard";
import { RemittanceEventListener } from "./listeners/transaction-event.listener";
// Controllers
import { NotificationController } from "./notification.controller";
// Core Services & Repositories
import { NotificationRepository } from "./notification.repository";
import { NotificationService } from "./notification.service";
import { NotificationAdminController } from "./notification-admin.controller";
import { NotificationInternalController } from "./notification-internal.controller";
// Legacy Senders (Providers)
import { EmailSender } from "./senders/email.sender";
import { PushSender } from "./senders/push.sender";
import { SensModule } from "./senders/sens/sens.module";
import { NotificationAdminService } from "./services/notification-admin.service";
import { NotificationSenderService } from "./services/notification-sender.service";
// Feature Services
import { NotificationTemplateService } from "./services/notification-template.service";
import { NotificationUseCases } from "./services/notification-usecases.service";
import { NotificationWorkerService } from "./services/notification-worker.service";

@Module({
  imports: [ScheduleModule.forRoot(), ConfigModule, UserModule, PrismaModule, EventEmitterModule.forRoot(), SensModule],
  controllers: [NotificationController, NotificationAdminController, NotificationInternalController],
  providers: [
    NotificationRepository,
    NotificationService,
    NotificationUseCases,
    NotificationTemplateService,
    NotificationAdminService,
    NotificationSenderService,
    NotificationWorkerService,
    NotificationPolicyService,
    RemittanceEventListener,
    EmailSender,
    PushSender,
    InternalApiKeyGuard,
    {
      provide: "NOTIFICATION_SENDERS",
      useFactory: (emailSender: EmailSender, pushSender: PushSender) => {
        return [emailSender, pushSender];
      },
      inject: [EmailSender, PushSender],
    },
  ],
  exports: [
    NotificationUseCases, // Exported to be utilized by Transfer, KYC modules
    NotificationService,
  ],
})
export class NotificationModule implements OnModuleInit {
  private readonly logger = new Logger("FirebaseAdmin");

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length > 0) {
      return;
    }

    const projectId = this.configService.get<string>("firebase.projectId");
    const isProduction = this.configService.get<string>("app.nodeEnv") === "production";

    // ADC (Application Default Credentials): firebase-admin discovers credentials
    // from GOOGLE_APPLICATION_CREDENTIALS (a WIF cred-config or a service-account
    // key), `gcloud auth application-default login`, or — inside a GCP-managed
    // runtime — the metadata server (no credentials file needed).
    const credentialsConfigured =
      !!this.configService.get<string>("firebase.credentialsPath") ||
      !!this.configService.get<boolean>("firebase.gcpManagedRuntime");

    if (!credentialsConfigured) {
      // Production: Fail-Fast. Missing credentials means push delivery is
      // silently broken — refuse to boot so the deploy fails loudly.
      if (isProduction) {
        throw new Error(
          "[FATAL] Application Default Credentials (ADC) are not configured in production. " +
            "Set GOOGLE_APPLICATION_CREDENTIALS or run within a GCP environment with an active service account.",
        );
      }

      // Dev/test: warn and skip. applicationDefault() throws when no credentials
      // are present, so we bail before calling it — contributors without
      // credentials can still boot (PushSender mocks sends when uninitialized).
      this.logger.warn(
        "ADC credentials are not configured — push notifications disabled in non-production. " +
          "Run `gcloud auth application-default login` or set GOOGLE_APPLICATION_CREDENTIALS to enable real sends.",
      );
      return;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        ...(projectId ? { projectId } : {}),
      });
      this.logger.log("Firebase Admin SDK initialized via ADC");
    } catch (error: unknown) {
      // ADC was expected but init still failed (malformed credentials file,
      // metadata server unreachable, etc.). Fail-fast in prod; degrade in dev.
      const message = error instanceof Error ? error.message : "Unknown error";
      if (isProduction) {
        throw new Error(`[FATAL] Failed to initialize Firebase Admin SDK via ADC: ${message}`);
      }
      this.logger.warn(`Firebase Admin SDK failed to initialize: ${message}. Push notifications disabled.`);
    }
  }
}
