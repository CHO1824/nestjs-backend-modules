import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

import { successResponse } from "@/common/utils/response.util";
import { AdminRoles } from "@/modules/admin/decorators/admin-roles.decorator";
import { AdminJwtAuthGuard } from "@/modules/admin/guards/admin-jwt-auth.guard";
import { AdminRolesGuard } from "@/modules/admin/guards/admin-roles.guard";

import { CreateFaqCategoryDto } from "./dto/create-faq-category.dto";
import { FaqCategoryListResponseDto } from "./dto/faq-category-list-response.dto";
import { FaqCategoryResponseDto } from "./dto/faq-category-response.dto";
import { ListFaqCategoriesDto } from "./dto/list-faq-categories.dto";
import { UpdateFaqCategoryDto } from "./dto/update-faq-category.dto";
import { FaqCategoryService } from "./faq-category.service";

@ApiTags("FAQ Categories")
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@AdminRoles("ADMIN")
@Controller("api/v1/faq-categories")
export class FaqCategoryController {
  constructor(private readonly faqCategoryService: FaqCategoryService) {}

  @Post()
  @ApiOperation({ summary: "Create FAQ category" })
  async createCategory(@Body() createFaqCategoryDto: CreateFaqCategoryDto) {
    const result = await this.faqCategoryService.createCategory(createFaqCategoryDto);
    return successResponse(result, "faq_category_created");
  }

  @Get()
  @ApiOperation({ summary: "Get FAQ category list" })
  @ApiOkResponse({ type: FaqCategoryListResponseDto })
  async getCategoryList(@Query() listFaqCategoriesDto: ListFaqCategoriesDto) {
    const result = await this.faqCategoryService.getCategoryList(listFaqCategoriesDto);
    return successResponse(result, "faq_category_list_retrieved");
  }

  @Get(":id")
  @ApiOperation({ summary: "Get FAQ category details" })
  @ApiParam({ name: "id", description: "FAQ category ID" })
  @ApiOkResponse({ type: FaqCategoryResponseDto })
  async getCategoryById(@Param("id") id: string) {
    const result = await this.faqCategoryService.getCategoryById(id);
    return successResponse(result, "faq_category_retrieved");
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update FAQ category" })
  @ApiParam({ name: "id", description: "FAQ category ID" })
  async updateCategory(@Param("id") id: string, @Body() updateFaqCategoryDto: UpdateFaqCategoryDto) {
    const result = await this.faqCategoryService.updateCategory(id, updateFaqCategoryDto);
    return successResponse(result, "faq_category_updated");
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete FAQ category" })
  @ApiParam({ name: "id", description: "FAQ category ID" })
  async deleteCategory(@Param("id") id: string) {
    const result = await this.faqCategoryService.deleteCategory(id);
    return successResponse(result, "faq_category_deleted");
  }
}
