import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, map } from "rxjs";

import { ApiResponse, successResponse } from "../utils/response.util";

export const SKIP_RESPONSE_WRAP_KEY = "skipResponseWrap";

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_WRAP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode || 200;

        // Skip wrapping for 204 No Content, binary data, or streams
        if (
          statusCode === 204 ||
          Buffer.isBuffer(data) ||
          typeof data?.pipe === "function"
        ) {
          return data;
        }

        // Already wrapped by successResponse() — don't double-wrap
        if (data && typeof data === "object" && "statusCode" in data && "data" in data && "error" in data) {
          return data;
        }

        return successResponse(data, "Success", statusCode);
      }),
    );
  }
}
