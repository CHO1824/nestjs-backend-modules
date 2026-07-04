import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { SENS_VENDOR, SensVendor } from "../../interfaces/sens-vendor.interface";
import { MockSensVendor } from "./mock-sens.adapter";
import { NcpSensVendor } from "./ncp-sens.adapter";

@Module({
  providers: [
    {
      provide: SENS_VENDOR,
      useFactory: (config: ConfigService): SensVendor => {
        const logger = new Logger("SensVendorFactory");
        const enabled = config.get<boolean>("ncp.sens.enabled");
        const accessKey = config.get<string>("ncp.accessKey");
        const secretKey = config.get<string>("ncp.secretKey");

        if (!enabled) {
          logger.log("NCP SENS disabled — using MockSensVendor (Alimtalk/SMS mocked).");
          return new MockSensVendor();
        }

        // Enabled but unconfigured = a misconfig that would silently drop
        // notifications. Fail-fast at boot instead of falling back to mock.
        if (!accessKey || !secretKey) {
          throw new Error("NCP SENS is enabled but NCP_ACCESS_KEY or NCP_SECRET_KEY is missing.");
        }

        logger.log("NCP SENS enabled — using real NcpSensVendor.");
        return new NcpSensVendor({
          accessKey,
          secretKey,
          endpoint: config.getOrThrow<string>("ncp.sens.endpoint"),
          alimtalkServiceId: config.getOrThrow<string>("ncp.sens.alimtalkServiceId"),
          smsServiceId: config.getOrThrow<string>("ncp.sens.smsServiceId"),
          kakaoChannelId: config.getOrThrow<string>("ncp.sens.kakaoChannelId"),
          smsFrom: config.getOrThrow<string>("ncp.sens.smsFrom"),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [SENS_VENDOR],
})
export class SensModule {}
