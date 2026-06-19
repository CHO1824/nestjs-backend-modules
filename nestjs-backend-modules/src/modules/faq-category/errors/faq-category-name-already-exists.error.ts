import { HttpStatus } from "@nestjs/common";

import { AppError } from "@/common/errors/app.error";

export class FaqCategoryNameAlreadyExistsError extends AppError {
  constructor() {
    super("FAQ_CATEGORY_NAME_ALREADY_EXISTS", "FAQ category name already exists", HttpStatus.CONFLICT);
  }
}
