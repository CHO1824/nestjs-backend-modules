import { Injectable, Logger } from "@nestjs/common";

import {
  SendAlimtalkParams,
  SendSmsParams,
  SensSendResult,
  SensVendor,
} from "../../interfaces/sens-vendor.interface";

/** Logs and always succeeds — used until real NCP keys/templates are live. */
@Injectable()
export class MockSensVendor implements SensVendor {
  private readonly logger = new Logger(MockSensVendor.name);

  async sendAlimtalk(params: SendAlimtalkParams): Promise<SensSendResult> {
    this.logger.log(`[MOCK Alimtalk] -> ${params.to} (template ${params.templateCode})`);
    return {
      success: true,
      channel: "KAKAO",
      provider: "NCP_SENS_MOCK",
      externalId: `K-mock-${Date.now()}`,
      cost: 15.0,
      error: null,
    };
  }

  async sendSms(params: SendSmsParams): Promise<SensSendResult> {
    this.logger.log(`[MOCK SMS] -> ${params.to}`);
    return {
      success: true,
      channel: "SMS",
      provider: "NCP_SENS_MOCK",
      externalId: `S-mock-${Date.now()}`,
      cost: 25.0,
      error: null,
    };
  }
}
