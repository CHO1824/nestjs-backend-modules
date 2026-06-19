import { Injectable } from "@nestjs/common";
import { NotificationCategory } from "../constants/notification.constants";

@Injectable()
export class NotificationPolicyService {
  /**
   * Enforces legal and business rules for notifications.
   */
  isAllowed(user: any, category: string, channel: string): boolean {
    // 1. Transactional notifications (P0) are always allowed
    if (category === NotificationCategory.TRANSACTIONAL) return true;

    // 2. Marketing Policy Check
    if (category === NotificationCategory.MARKETING) {
      const pref = user.preferences?.find((p: any) => p.channel === channel);
      if (!pref?.isOptIn) return false;

      // 3. Night-time Restriction (21:00 - 08:00)
      const currentHour = this.getUserLocalHour(user.timezone || "UTC");
      if (currentHour >= 21 || currentHour < 8) return false;
    }

    return true;
  }

  private getUserLocalHour(timezone: string): number {
    try {
      const options: Intl.DateTimeFormatOptions = { timeZone: timezone, hour: "numeric", hour12: false };
      return parseInt(new Date().toLocaleString("en-US", options), 10);
    } catch (e) {
      return new Date().getUTCHours();
    }
  }
}
