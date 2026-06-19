import { HttpStatus } from "@nestjs/common";

import { AppError } from "@/common/errors/app.error";

export class FaqNotFoundError extends AppError {
  constructor() {
    super("FAQ_NOT_FOUND", "FAQ not found", HttpStatus.NOT_FOUND);
  }
}
