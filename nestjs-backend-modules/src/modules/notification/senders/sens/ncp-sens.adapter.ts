import { Logger } from "@nestjs/common";
import * as crypto from "crypto";

import {
  SendAlimtalkParams,
  SendSmsParams,
  SensChannel,
  SensSendResult,
  SensVendor,
} from "../../interfaces/sens-vendor.interface";

export interface NcpSensConfig {
  /** NCP IAM access key (shared with other NCP services). */
  accessKey: string;
  /** NCP IAM secret key — HMAC signing key. */
  secretKey: string;
  /** API gateway base, e.g. https://sens.apigw.fin-ntruss.com (fin cloud). */
  endpoint: string;
  /** Alimtalk service id: ncp:kkobizmsg:fkr:...:vpay */
  alimtalkServiceId: string;
  /** SMS service id: ncp:sms:fkr:...:vpay */
  smsServiceId: string;
  /** KakaoTalk channel search id (plusFriendId), e.g. @vpayv. */
  kakaoChannelId: string;
  /** Registered SMS sender number (used as `from` for SMS + Alimtalk SMS failover). */
  smsFrom: string;
}

/** Shape of the bits of the NCP SENS response we read. */
interface NcpResponse {
  requestId?: string;
  statusCode?: string;
  statusName?: string;
  messages?: Array<{ messageId?: string }>;
}

/** Real NCP SENS vendor — HMAC-SHA256 signed Alimtalk/SMS calls. */
export class NcpSensVendor implements SensVendor {
  private readonly logger = new Logger(NcpSensVendor.name);
  private static readonly REQUEST_TIMEOUT_MS = 5_000;

  // Auth + Alimtalk fields must be present in real mode. SMS fields
  // (smsServiceId/smsFrom) are optional: the adapter runs Alimtalk-only until
  // the SMS sender number is registered — sendSms guards on them at call time.
  private static readonly REQUIRED_KEYS: Array<keyof NcpSensConfig> = [
    "accessKey",
    "secretKey",
    "endpoint",
    "alimtalkServiceId",
    "kakaoChannelId",
  ];

  constructor(private readonly config: NcpSensConfig) {
    const missing = NcpSensVendor.REQUIRED_KEYS.filter((key) => !config[key]);
    if (missing.length > 0) {
      throw new Error(`NcpSensVendor init failed — missing/empty config: ${missing.join(", ")}`);
    }
  }

  async sendAlimtalk(params: SendAlimtalkParams): Promise<SensSendResult> {
    const path = `/alimtalk/v2/services/${encodeURIComponent(this.config.alimtalkServiceId)}/messages`;

    const message: Record<string, unknown> = {
      to: this.normalizeNumber(params.to),
      content: params.content,
    };

    // NCP-native SMS failover handles delivery-side failures asynchronously.
    // Only enable it when an SMS sender number is configured — otherwise NCP rejects it.
    if (params.smsFailoverContent && this.config.smsFrom) {
      message.useSmsFailover = true;
      message.failoverConfig = {
        type: this.smsType(params.smsFailoverContent),
        from: this.config.smsFrom,
        content: params.smsFailoverContent,
      };
    }

    const body = {
      plusFriendId: this.config.kakaoChannelId,
      templateCode: params.templateCode,
      messages: [message],
    };

    return this.post(path, body, "KAKAO");
  }

  async sendSms(params: SendSmsParams): Promise<SensSendResult> {
    if (!this.config.smsFrom || !this.config.smsServiceId) {
      return {
        success: false,
        channel: "SMS",
        provider: "NCP_SENS",
        externalId: null,
        cost: 0,
        error: "SMS is not configured (smsFrom/smsServiceId missing)",
      };
    }

    const path = `/sms/v2/services/${encodeURIComponent(this.config.smsServiceId)}/messages`;
    const content = params.content;
    const body = {
      // SMS up to 80 bytes (EUC-KR), LMS above — pick by length to avoid the
      // higher LMS rate on short bodies (e.g. 6-digit OTPs).
      type: this.smsType(content),
      from: this.config.smsFrom,
      content,
      messages: [{ to: this.normalizeNumber(params.to), content }],
    };

    return this.post(path, body, "SMS");
  }

  /** Builds the NCP API Gateway v2 HMAC-SHA256 signature for a request. */
  private makeSignature(method: string, path: string, timestamp: string): string {
    const message = `${method} ${path}\n${timestamp}\n${this.config.accessKey}`;
    return crypto.createHmac("sha256", this.config.secretKey).update(message).digest("base64");
  }

  /** Strips formatting so NCP receives bare digits (e.g. +82 10 → 8210...). */
  private normalizeNumber(value: string): string {
    return value.replace(/[^0-9]/g, "");
  }

  /** NCP bills SMS (<=80 EUC-KR bytes) cheaper than LMS — pick by byte length. */
  private smsType(content: string): "SMS" | "LMS" {
    let bytes = 0;
    for (let i = 0; i < content.length; i++) {
      bytes += content.charCodeAt(i) >> 7 ? 2 : 1;
    }
    return bytes <= 80 ? "SMS" : "LMS";
  }

  private async post(path: string, body: unknown, channel: SensChannel): Promise<SensSendResult> {
    const provider = "NCP_SENS";
    try {
      const timestamp = Date.now().toString();
      const signature = this.makeSignature("POST", path, timestamp);

      const res = await fetch(`${this.config.endpoint}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-ncp-apigw-timestamp": timestamp,
          "x-ncp-iam-access-key": this.config.accessKey,
          "x-ncp-apigw-signature-v2": signature,
        },
        body: JSON.stringify(body),
        // Cap the request so an unresponsive NCP API can't hang the worker.
        signal: AbortSignal.timeout(NcpSensVendor.REQUEST_TIMEOUT_MS),
      });

      const data = (await res.json().catch(() => ({}))) as NcpResponse;

      if (!res.ok) {
        const error = `HTTP ${res.status} ${data.statusName ?? ""}`.trim();
        this.logger.warn(`[NCP_SENS] ${channel} send rejected: ${error}`);
        return { success: false, channel, provider, externalId: null, cost: 0, error };
      }

      const externalId = data.requestId ?? data.messages?.[0]?.messageId ?? null;
      return { success: true, channel, provider, externalId, cost: 0, error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`[NCP_SENS] ${channel} send failed: ${error}`);
      return { success: false, channel, provider, externalId: null, cost: 0, error };
    }
  }
}
