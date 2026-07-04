import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import formData from "form-data";
import Mailgun from "mailgun.js";
import type { IMailgunClient } from "mailgun.js/Interfaces/MailgunClient/IMailgunClient";

import { NotificationSender, RenderedContent } from "@/modules/notification/interfaces/notification-sender.interface";

import { NotificationDeliveryError, RecipientNotFoundError } from "../errors/notification.errors";

@Injectable()
export class EmailSender implements NotificationSender {
  private readonly logger = new Logger(EmailSender.name);
  private readonly client?: IMailgunClient;
  private readonly domain?: string;
  private readonly fromAddress?: string;
  private readonly configured: boolean;
  readonly channel = "EMAIL";

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>("mailgun.apiKey");
    const domain = this.configService.get<string>("mailgun.domain");
    const apiUrl = this.configService.get<string>("mailgun.apiUrl");
    const fromEmail = this.configService.get<string>("mailgun.fromEmail");
    const fromName = this.configService.get<string>("mailgun.fromName");
    const isProduction = this.configService.get<string>("app.nodeEnv") === "production";

    if (!apiKey || !domain || !fromEmail) {
      // Production: Fail-Fast. Missing creds in prod means transactional mail
      // is silently broken — refuse to boot so the deploy fails loudly.
      if (isProduction) {
        const missing = [!apiKey && "MAILGUN_API_KEY", !domain && "MAILGUN_DOMAIN", !fromEmail && "MAILGUN_FROM_EMAIL"]
          .filter(Boolean)
          .join(", ");
        throw new Error(`[FATAL] Mailgun is not configured in production. Missing: ${missing}.`);
      }

      // Dev/test: degrade to a logging mock so contributors without Mailgun
      // creds can still boot the app. Matches the policy MailService keeps for
      // auth-flow mail (see commit 117de55).
      this.logger.warn(
        "Mailgun is not fully configured — EmailSender will mock sends in non-production. " +
          "Set MAILGUN_API_KEY / MAILGUN_DOMAIN / MAILGUN_FROM_EMAIL to send real mail.",
      );
      this.configured = false;
      return;
    }

    const mailgun = new Mailgun(formData);
    this.client = mailgun.client({ username: "api", key: apiKey, url: apiUrl });
    this.domain = domain;
    this.fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    this.configured = true;
  }

  async send(outboxId: string, recipientInfo: string | string[], content: RenderedContent): Promise<void> {
    if (!recipientInfo) {
      throw new RecipientNotFoundError();
    }

    if (!this.configured || !this.client || !this.domain || !this.fromAddress) {
      this.logger.log(
        `[MOCK EMAIL] Outbox ID: ${outboxId} - Send to ${recipientInfo} skipped (Mailgun not configured)`,
      );
      return;
    }

    try {
      this.logger.log(`[EmailSender] Outbox ID: ${outboxId} - Sending to: ${recipientInfo}`);

      await this.client.messages.create(this.domain, {
        from: this.fromAddress,
        to: Array.isArray(recipientInfo) ? recipientInfo : [recipientInfo],
        subject: content.title,
        html: content.message,
      });

      this.logger.log(`[EmailSender] Outbox ID: ${outboxId} - Delivered successfully.`);
    } catch (error: any) {
      this.logger.error(`[EmailSender] Failed to dispatch: ${error.message}`);
      throw new NotificationDeliveryError(this.channel);
    }
  }
}
