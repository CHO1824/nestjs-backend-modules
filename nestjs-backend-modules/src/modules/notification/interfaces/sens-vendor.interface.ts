// Port for NCP SENS (Alimtalk + SMS). Mock or real impl is chosen by the
// SENS_VENDOR factory in NotificationModule based on config.

/** DI token for the active SensVendor implementation. */
export const SENS_VENDOR = "SENS_VENDOR";

export type SensChannel = "KAKAO" | "SMS";

/** Normalized result the sender service records into the delivery log. */
export interface SensSendResult {
  success: boolean;
  channel: SensChannel;
  provider: string;
  externalId: string | null;
  cost: number;
  error: string | null;
}

export interface SendAlimtalkParams {
  /** NCP-registered template code (e.g. "VPAYOTP"). */
  templateCode: string;
  /** Recipient phone number (any format; the adapter normalizes). */
  to: string;
  /** Rendered message body that matches the approved template. */
  content: string;
  /** If set, NCP sends this SMS when Alimtalk delivery fails (useSmsFailover). */
  smsFailoverContent?: string;
}

export interface SendSmsParams {
  to: string;
  content: string;
}

export interface SensVendor {
  sendAlimtalk(params: SendAlimtalkParams): Promise<SensSendResult>;
  sendSms(params: SendSmsParams): Promise<SensSendResult>;
}
