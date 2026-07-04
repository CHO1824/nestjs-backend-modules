import { Injectable } from "@nestjs/common";

import { NotificationDeliveryStatus } from "../../../../generated/prisma/client";
import { NotificationEventType } from "../constants/notification.constants";
import { MessageTemplateListItemDto } from "../dto/message-template-list-item.dto";
import { InvalidNotificationEventError } from "../errors/notification.errors";
import { NotificationRepository } from "../notification.repository";
import { extractVariables, SupportedLocale, TEMPLATE_TEXT } from "./notification-template.defaults";
import { NotificationTemplateService } from "./notification-template.service";

const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["en", "ko"];

@Injectable()
export class NotificationAdminService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly templateService: NotificationTemplateService,
  ) {}

  async getDashboardStats(startDate: Date, endDate: Date) {
    const [counts, totalCostResult, recentFailures] = await Promise.all([
      this.repository.getDeliveryCounts(startDate, endDate),
      this.repository.getTotalCost(startDate, endDate),
      this.repository.getRecentFailures(5),
    ]);

    const totalSent = counts
      .filter((c) => c.status === NotificationDeliveryStatus.SENT)
      .reduce((acc, cur) => acc + cur._count._all, 0);
    const totalFailed = counts
      .filter((c) => c.status === NotificationDeliveryStatus.FAILED)
      .reduce((acc, cur) => acc + cur._count._all, 0);

    const channelDistribution = counts.reduce(
      (acc, cur) => {
        acc[cur.channel] = (acc[cur.channel] || 0) + cur._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      overview: {
        totalSent,
        totalFailed,
        totalCost: Number(totalCostResult._sum.cost || 0),
      },
      channelDistribution,
      recentFailures,
    };
  }

  // ==========================================
  // Editable message templates
  // ==========================================

  // Lists every event's copy, DB override merged over the code default.
  async listMessageTemplates(): Promise<MessageTemplateListItemDto[]> {
    const rows = await this.repository.findAllMessageTemplates();
    const byKey = new Map(rows.map((r) => [`${r.eventType}:${r.locale}`, r]));

    const items: MessageTemplateListItemDto[] = [];
    for (const eventType of Object.keys(TEMPLATE_TEXT) as NotificationEventType[]) {
      const variables = extractVariables(eventType);
      for (const locale of SUPPORTED_LOCALES) {
        const stored = byKey.get(`${eventType}:${locale}`);
        const def = TEMPLATE_TEXT[eventType][locale];
        items.push({
          eventType,
          locale,
          title: stored?.title ?? def.title,
          message: stored?.message ?? def.message,
          variables,
          isCustomized: !!stored && (stored.title !== def.title || stored.message !== def.message),
          updatedBy: stored?.updatedBy ?? null,
          updatedAt: stored?.updatedAt ?? null,
        });
      }
    }
    return items;
  }

  async getMessageTemplate(eventType: string, locale: string) {
    this.assertValid(eventType, locale);
    const stored = await this.repository.findMessageTemplate(eventType, locale);
    const def = TEMPLATE_TEXT[eventType as NotificationEventType][locale];
    return {
      eventType,
      locale,
      title: stored?.title ?? def.title,
      message: stored?.message ?? def.message,
      defaultTitle: def.title,
      defaultMessage: def.message,
      variables: extractVariables(eventType as NotificationEventType),
      isCustomized: !!stored && (stored.title !== def.title || stored.message !== def.message),
      updatedBy: stored?.updatedBy ?? null,
      updatedAt: stored?.updatedAt ?? null,
    };
  }

  async updateMessageTemplate(
    eventType: string,
    locale: string,
    data: { title: string; message: string },
    adminId?: string,
  ) {
    this.assertValid(eventType, locale);
    const saved = await this.repository.upsertMessageTemplate({
      eventType,
      locale,
      title: data.title,
      message: data.message,
      updatedBy: adminId ?? null,
    });
    // Drop the render cache so the new copy takes effect immediately, not after the TTL.
    this.templateService.invalidateCache();
    return {
      eventType: saved.eventType,
      locale: saved.locale,
      title: saved.title,
      message: saved.message,
      updatedBy: saved.updatedBy,
      updatedAt: saved.updatedAt,
    };
  }

  // Restores an event's copy to the code default.
  async resetMessageTemplate(eventType: string, locale: string) {
    this.assertValid(eventType, locale);
    const def = TEMPLATE_TEXT[eventType as NotificationEventType][locale];
    const saved = await this.repository.upsertMessageTemplate({
      eventType,
      locale,
      title: def.title,
      message: def.message,
      updatedBy: null,
    });
    // Drop the render cache so the default copy takes effect immediately, not after the TTL.
    this.templateService.invalidateCache();
    return { eventType: saved.eventType, locale: saved.locale, title: saved.title, message: saved.message };
  }

  private isKnownEvent(eventType: string): boolean {
    return Object.prototype.hasOwnProperty.call(TEMPLATE_TEXT, eventType);
  }

  private isSupportedLocale(locale: string): locale is SupportedLocale {
    return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
  }

  // Narrows `locale` to SupportedLocale for callers on success.
  private assertValid(eventType: string, locale: string): asserts locale is SupportedLocale {
    if (!this.isKnownEvent(eventType) || !this.isSupportedLocale(locale)) {
      throw new InvalidNotificationEventError();
    }
  }
}
