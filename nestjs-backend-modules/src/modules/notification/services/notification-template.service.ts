import { Injectable, Logger, OnModuleInit } from "@nestjs/common";

import { NotificationEventType } from "../constants/notification.constants";
import { NotificationPayloadByType } from "../interfaces/notification-payload.interface";
import { RenderedContent } from "../interfaces/notification-sender.interface";
import { NotificationRepository } from "../notification.repository";
import {
  DB_EXTERNALIZED_EXCLUDED_CHANNEL,
  DEFAULT_TEMPLATE_META,
  DEFAULT_TEMPLATE_TEXT,
  interpolate,
  SupportedLocale,
  TEMPLATE_META,
  TEMPLATE_TEXT,
  TemplateText,
} from "./notification-template.defaults";

// Cache the (small) template table to avoid a DB read on every worker tick.
const CACHE_TTL_MS = 60_000;

type OverrideMap = Map<string, TemplateText>;

/**
 * Renders localized copy: DB override wins, else code default.
 * Alimtalk (KAKAO) always uses code defaults to match the NCP console template.
 */
@Injectable()
export class NotificationTemplateService implements OnModuleInit {
  private readonly logger = new Logger(NotificationTemplateService.name);

  private cache: OverrideMap | null = null;
  private cacheExpiresAt = 0;
  private cachePromise: Promise<OverrideMap> | null = null;

  constructor(private readonly repository: NotificationRepository) {}

  // Seed defaults (skipDuplicates keeps edited rows). Best-effort: never block boot.
  async onModuleInit(): Promise<void> {
    try {
      const seeded = await this.repository.seedMessageTemplates(this.buildSeedRows());
      if (seeded > 0) {
        this.logger.log(`Seeded ${seeded} default notification template row(s).`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Notification template seeding skipped: ${message}`);
    }
  }

  exists(type: string): type is NotificationEventType {
    return Object.prototype.hasOwnProperty.call(TEMPLATE_TEXT, type);
  }

  /**
   * Renders copy for an event, filling placeholders from the payload.
   * KAKAO uses code defaults; other channels prefer the DB override.
   */
  async render<T extends NotificationEventType>(
    type: T,
    payload: NotificationPayloadByType[T],
    locale: string = "en",
    channel?: string,
  ): Promise<RenderedContent> {
    const normalizedLocale: SupportedLocale = locale === "ko" ? "ko" : "en";
    const codeText = TEMPLATE_TEXT[type]?.[normalizedLocale] ?? DEFAULT_TEMPLATE_TEXT[normalizedLocale];
    const meta = TEMPLATE_META[type] ?? DEFAULT_TEMPLATE_META;

    let text = codeText;
    if (channel !== DB_EXTERNALIZED_EXCLUDED_CHANNEL) {
      const override = await this.getOverride(type, normalizedLocale);
      if (override) text = override;
    }

    const payloadRecord = payload as Record<string, unknown>;
    // Event-supplied sysCode (audit/system events) wins over the code default.
    const sysCode = (typeof payloadRecord?.sysCode === "string" && payloadRecord.sysCode) || meta.defaultSysCode;

    return {
      title: interpolate(text.title, payloadRecord),
      message: interpolate(text.message, payloadRecord),
      sysCode,
      priority: meta.priority,
    };
  }

  /** Drops the override cache so the next render re-reads from the DB. */
  invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
    this.cachePromise = null;
  }

  private async getOverride(type: NotificationEventType, locale: SupportedLocale): Promise<TemplateText | undefined> {
    const overrides = await this.loadOverrides();
    return overrides.get(this.cacheKey(type, locale));
  }

  private async loadOverrides(): Promise<OverrideMap> {
    if (this.cache && Date.now() < this.cacheExpiresAt) {
      return this.cache;
    }
    // A load is already in flight — share it so concurrent renders don't stampede the DB.
    if (this.cachePromise) {
      return this.cachePromise;
    }
    this.cachePromise = (async () => {
      const map: OverrideMap = new Map();
      try {
        const rows = await this.repository.findAllMessageTemplates();
        for (const row of rows) {
          map.set(this.cacheKey(row.eventType, row.locale), { title: row.title, message: row.message });
        }
        this.cache = map;
        this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      } catch (error: unknown) {
        // DB down / table missing → fall back to code defaults instead of failing.
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to load notification template overrides, using code defaults: ${message}`);
        return this.cache ?? map;
      } finally {
        this.cachePromise = null;
      }
      return map;
    })();
    return this.cachePromise;
  }

  private cacheKey(type: string, locale: string): string {
    return `${type}:${locale}`;
  }

  private buildSeedRows(): { eventType: string; locale: string; title: string; message: string }[] {
    const rows: { eventType: string; locale: string; title: string; message: string }[] = [];
    for (const type of Object.keys(TEMPLATE_TEXT) as NotificationEventType[]) {
      for (const locale of ["en", "ko"] as SupportedLocale[]) {
        const text = TEMPLATE_TEXT[type][locale];
        rows.push({ eventType: type, locale, title: text.title, message: text.message });
      }
    }
    return rows;
  }
}
