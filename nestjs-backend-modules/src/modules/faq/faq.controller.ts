import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { successResponse } from "@/common/utils/response.util";
import { AdminRoles } from "@/modules/admin/decorators/admin-roles.decorator";
import { AdminJwtAuthGuard } from "@/modules/admin/guards/admin-jwt-auth.guard";
import { AdminRolesGuard } from "@/modules/admin/guards/admin-roles.guard";

import { CreateFaqDto } from "./dto/create-faq.dto";
import { FaqListResponseDto } from "./dto/faq-list-response.dto";
import { FaqResponseDto } from "./dto/faq-response.dto";
import { ListFaqQueryDto } from "./dto/list-faq-query.dto";
import { UpdateFaqDto } from "./dto/update-faq.dto";
import { FaqService } from "./faq.service";

@ApiTags("FAQ")
@ApiBearerAuth()
@Controller("api/v1/faq")
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Post()
  @UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
  @AdminRoles("ADMIN")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create FAQ (admin)" })
  @ApiResponse({ status: 201, description: "FAQ created successfully", type: FaqResponseDto })
  async create(@Body() createFaqDto: CreateFaqDto) {
    const data = await this.faqService.create(createFaqDto);
    return successResponse(data, "faq_created", HttpStatus.CREATED);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get FAQ list (public)" })
  @ApiResponse({ status: 200, description: "FAQ list retrieved successfully", type: FaqListResponseDto })
  async findAll(@Query() query: ListFaqQueryDto) {
    const data = await this.faqService.findAll(query);
    return successResponse(data, "faq_list_retrieved");
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get FAQ detail (public)" })
  @ApiResponse({ status: 200, description: "FAQ retrieved successfully", type: FaqResponseDto })
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    const data = await this.faqService.findOne(id);
    return successResponse(data, "faq_retrieved");
  }

  @Patch(":id")
  @UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
  @AdminRoles("ADMIN")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update FAQ (admin)" })
  @ApiResponse({ status: 200, description: "FAQ updated successfully", type: FaqResponseDto })
  async update(@Param("id", new ParseUUIDPipe()) id: string, @Body() updateFaqDto: UpdateFaqDto) {
    const data = await this.faqService.update(id, updateFaqDto);
    return successResponse(data, "faq_updated");
  }

  @Delete(":id")
  @UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
  @AdminRoles("ADMIN")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete FAQ (admin)" })
  @ApiResponse({ status: 200, description: "FAQ deleted successfully" })
  async delete(@Param("id", new ParseUUIDPipe()) id: string) {
    await this.faqService.delete(id);
    return successResponse({ deleted: true }, "faq_deleted");
  }
}
