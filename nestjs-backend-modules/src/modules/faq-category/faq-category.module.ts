import { Module } from "@nestjs/common";

import { FaqCategoryController } from "./faq-category.controller";
import { FaqCategoryRepository } from "./faq-category.repository";
import { FaqCategoryService } from "./faq-category.service";

@Module({
  controllers: [FaqCategoryController],
  providers: [FaqCategoryService, FaqCategoryRepository],
  exports: [FaqCategoryService, FaqCategoryRepository],
})
export class FaqCategoryModule {}
