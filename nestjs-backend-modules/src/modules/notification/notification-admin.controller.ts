import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { successResponse } from "@/common/utils/response.util";

import { AdminJwtAuthGuard } from "../admin/guards/admin-jwt-auth.guard";
import { AdminRolesGuard } from "../admin/guards/admin-roles.guard";
import { GetNotificationStatsDto } from "./dto/get-notification-stats.dto";
import { NotificationAdminService } from "./services/notification-admin.service";

@ApiTags("Notifications (Admin)")
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller("admin/notifications")
export class NotificationAdminController {
  constructor(private readonly adminService: NotificationAdminService) {}

  @Get("stats")
  @ApiOperation({ summary: "[Admin] Notification dashboard delivery stats" })
  async getStats(@Query() query: GetNotificationStatsDto) {
    const start = new Date(query.startDate);
    const end = new Date(query.endDate);

    const data = await this.adminService.getDashboardStats(start, end);

    return successResponse(data, "Success");
  }
}
