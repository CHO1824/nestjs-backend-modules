import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ApiResponse, successResponse } from "@/common/utils/response.util";

import { AdminRoles } from "../admin/decorators/admin-roles.decorator";
import { AdminUser, AdminUserPayload } from "../admin/decorators/admin-user.decorator";
import { AdminJwtAuthGuard } from "../admin/guards/admin-jwt-auth.guard";
import { AdminRolesGuard } from "../admin/guards/admin-roles.guard";
import { GetNotificationStatsDto } from "./dto/get-notification-stats.dto";
import { MessageTemplateListItemDto } from "./dto/message-template-list-item.dto";
import { TemplateLocaleParamDto, UpdateMessageTemplateDto } from "./dto/update-message-template.dto";
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

  // Editable copy for EMAIL / PUSH / SMS / in-app. Alimtalk is managed in NCP.
  @Get("templates")
  @ApiOperation({ summary: "[Admin] List editable notification message templates" })
  async listTemplates(): Promise<ApiResponse<MessageTemplateListItemDto[]>> {
    const data = await this.adminService.listMessageTemplates();
    return successResponse(data, "Success");
  }

  @Get("templates/:eventType/:locale")
  @ApiOperation({ summary: "[Admin] Get a single notification message template" })
  async getTemplate(@Param() params: TemplateLocaleParamDto) {
    const data = await this.adminService.getMessageTemplate(params.eventType, params.locale);
    return successResponse(data, "Success");
  }

  @Put("templates/:eventType/:locale")
  @AdminRoles("SUPER_ADMIN", "ADMIN")
  @ApiOperation({ summary: "[Admin] Update notification message copy (no code deploy needed)" })
  async updateTemplate(
    @Param() params: TemplateLocaleParamDto,
    @Body() dto: UpdateMessageTemplateDto,
    @AdminUser() admin: AdminUserPayload,
  ) {
    const data = await this.adminService.updateMessageTemplate(params.eventType, params.locale, dto, admin?.adminId);
    return successResponse(data, "Template updated");
  }

  @Post("templates/:eventType/:locale/reset")
  @AdminRoles("SUPER_ADMIN", "ADMIN")
  @ApiOperation({ summary: "[Admin] Reset a notification message template to its built-in default" })
  async resetTemplate(@Param() params: TemplateLocaleParamDto) {
    const data = await this.adminService.resetMessageTemplate(params.eventType, params.locale);
    return successResponse(data, "Template reset to default");
  }
}
