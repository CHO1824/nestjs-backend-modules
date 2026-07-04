import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "crypto";

import {
  InternalEndpointDisabledError,
  InternalTokenInvalidError,
  InternalTokenMissingError,
} from "../errors/notification.errors";

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);
  // Pre-hashed expected token. SHA-256 normalizes both sides to a fixed 32-byte
  // digest before timingSafeEqual, which removes the length-based side-channel
  // that a raw length check + timingSafeEqual would otherwise expose.
  private readonly expectedKeyHash?: Buffer;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    const expectedKey = this.configService.get<string>("internal.apiKey");
    this.isProduction = this.configService.get<string>("app.nodeEnv") === "production";

    if (expectedKey) {
      this.expectedKeyHash = createHash("sha256").update(expectedKey, "utf8").digest();
    } else {
      // Production: log only — actual block happens at canActivate(). Throwing
      // here would break boot for the entire NotificationModule even when
      // /internal/* routes are never hit.
      const msg = "INTERNAL_API_KEY is not set. /internal/notifications/* will reject all requests.";
      if (this.isProduction) {
        this.logger.error(`[FATAL] ${msg}`);
      } else {
        this.logger.warn(msg);
      }
    }
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.expectedKeyHash) {
      // Hard 401 in every environment when the server doesn't know the
      // expected token — refusing the call is always safer than letting it
      // through, regardless of NODE_ENV.
      throw new InternalEndpointDisabledError();
    }

    const request = context.switchToHttp().getRequest();
    const provided = request.headers["x-internal-token"];

    if (!provided || typeof provided !== "string") {
      throw new InternalTokenMissingError();
    }

    const providedHash = createHash("sha256").update(provided, "utf8").digest();

    if (!timingSafeEqual(providedHash, this.expectedKeyHash)) {
      throw new InternalTokenInvalidError();
    }

    return true;
  }
}
