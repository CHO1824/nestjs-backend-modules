import { Injectable } from "@nestjs/common";
import { NotificationRepository } from "../notification.repository";
import { NotificationDeliveryStatus } from "../../../../generated/prisma/client";

@Injectable()
export class NotificationAdminService {
  constructor(private readonly repository: NotificationRepository) {}

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
}
