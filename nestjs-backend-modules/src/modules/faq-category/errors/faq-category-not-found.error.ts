import { HttpStatus } from "@nestjs/common";

import { AppError } from "@/common/errors/app.error";

export class FaqCategoryNotFoundError extends AppError {
  constructor() {
    super("FAQ_CATEGORY_NOT_FOUND", "FAQ category not found", HttpStatus.NOT_FOUND);
  }
}
