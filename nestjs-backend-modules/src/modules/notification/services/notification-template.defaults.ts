import { NOTIFICATION_PRIORITY, NotificationEventType } from "../constants/notification.constants";

/**
 * Default copy for every notification event (seed source + fallback).
 * `{{key}}` / `{{key|default}}` placeholders are filled from the payload.
 * sysCode / priority stay in code (not admin-editable).
 */

export type SupportedLocale = "en" | "ko";

export interface TemplateText {
  title: string;
  message: string;
}

export interface TemplateMeta {
  /** Fallback system code; overridden by `payload.sysCode` when the event carries one. */
  defaultSysCode: string;
  priority: (typeof NOTIFICATION_PRIORITY)[keyof typeof NOTIFICATION_PRIORITY];
}

type LocaleText = Record<SupportedLocale, TemplateText>;

export const TEMPLATE_TEXT: Record<NotificationEventType, LocaleText> = {
  // 1. KYC
  [NotificationEventType.KYC_PENDING]: {
    en: {
      title: "KYC Documents Required",
      message: "Hello {{userName|User}}, additional photos of your ID are required for verification.",
    },
    ko: {
      title: "KYC Documents Required",
      message: "안녕하세요 {{userName|고객}}님, 신분증 사진 추가 제출이 필요합니다.",
    },
  },
  [NotificationEventType.KYC_REJECTED]: {
    en: {
      title: "KYC Rejected",
      message: "Your verification was rejected. Reason: {{reason|Invalid documents}}.",
    },
    ko: {
      title: "KYC Rejected",
      message: "본인 인증이 거절되었습니다. 사유: {{reason|서류 불충분}}.",
    },
  },
  [NotificationEventType.KYC_APPROVED]: {
    en: {
      title: "KYC Approved",
      message: "Congratulations {{userName}}! Your identity verification is complete.",
    },
    ko: {
      title: "KYC Approved",
      message: "축하합니다 {{userName}}님! 본인 인증이 완료되었습니다.",
    },
  },
  [NotificationEventType.KYC_REVERIFICATION_SUSPENDED]: {
    en: {
      title: "Account Suspended",
      message: "Identity re-verification failed. Your account has been suspended. Please contact support.",
    },
    ko: {
      title: "계정 정지 안내",
      message: "본인 재확인에 실패하여 계정이 정지되었습니다. 고객센터에 문의해 주세요.",
    },
  },
  [NotificationEventType.KYC_REVERIFICATION_REQUIRED]: {
    en: {
      title: "Identity Re-verification Required",
      message: "Identity re-verification is required. Transfers are paused until you complete it. Please open the app.",
    },
    ko: {
      title: "본인 재확인 필요",
      message: "VPay 본인 재확인이 필요합니다. 앱을 열어 확인해 주세요. 재확인 전까지 송금이 일시 중단됩니다.",
    },
  },
  [NotificationEventType.KYC_REVERIFICATION_REQUIRED_ADMIN]: {
    en: {
      title: "Identity Re-verification Required",
      message: "Identity re-verification is required under our security policy. Please open the app to verify.",
    },
    ko: {
      title: "본인 재확인 필요",
      message: "보안 정책에 따라 본인 재확인이 필요합니다. 앱을 열어 확인해 주세요.",
    },
  },
  [NotificationEventType.KYC_REVERIFICATION_SUCCESS]: {
    en: {
      title: "Identity Verified",
      message: "Identity verification is complete. You can use transfer services again.",
    },
    ko: {
      title: "본인 확인 완료",
      message: "본인 확인이 완료되었습니다. 송금 서비스를 다시 이용할 수 있습니다.",
    },
  },

  // 2. Remittance
  [NotificationEventType.REMITTANCE_PROCESSING]: {
    en: {
      title: "Transfer Processing",
      message: "The transfer of {{amount}} {{currency}} to {{recipientName}} has started.",
    },
    ko: {
      title: "Transfer Processing",
      message: "{{recipientName}}님께 보내는 {{amount}} {{currency}} 송금이 시작되었습니다.",
    },
  },
  [NotificationEventType.REMITTANCE_DELAYED]: {
    en: {
      title: "Transfer Delayed",
      message: "Transfer to {{recipientName}} is delayed due to bank maintenance.",
    },
    ko: {
      title: "Transfer Delayed",
      message: "{{recipientName}}님께 보내는 송금이 은행 점검으로 인해 지연되고 있습니다.",
    },
  },
  [NotificationEventType.REMITTANCE_FAILED]: {
    en: {
      title: "Transfer Failed",
      message: "The transfer of {{amount}} failed. Reason: {{reason|Account mismatch}}.",
    },
    ko: {
      title: "Transfer Failed",
      message: "{{amount}} 송금이 실패하였습니다. 사유: {{reason|계좌 정보 불일치}}.",
    },
  },
  [NotificationEventType.REMITTANCE_COMPLETED]: {
    en: {
      title: "Transfer Completed",
      message: "Transfer of {{amount}} to {{recipientName}} has been successfully completed.",
    },
    ko: {
      title: "Transfer Completed",
      message: "{{recipientName}}님께 보내는 {{amount}} 송금이 성공적으로 완료되었습니다.",
    },
  },

  // 3. Limit & FX
  [NotificationEventType.LIMIT_WARNING]: {
    en: {
      title: "Limit Warning",
      message: "Your remaining transfer limit for this year is {{remainingLimit}}.",
    },
    ko: {
      title: "한도 경고",
      message: "올해 잔여 송금 한도는 {{remainingLimit}} 입니다.",
    },
  },
  [NotificationEventType.FX_ALERT]: {
    en: {
      title: "Target FX Reached",
      message: "The {{currency}} rate has reached your target of {{targetRate}}!",
    },
    ko: {
      title: "목표 환율 도달",
      message: "{{currency}} 환율이 설정하신 목표치 {{targetRate}}에 도달했습니다!",
    },
  },

  // 4. Support
  [NotificationEventType.TICKET_RECEIVED]: {
    en: {
      title: "Support Ticket Received",
      message: "Your inquiry [{{ticketId}}] has been successfully received.",
    },
    ko: {
      title: "문의 접수 완료",
      message: "문의하신 내역 [{{ticketId}}]이 정상적으로 접수되었습니다.",
    },
  },
  [NotificationEventType.TICKET_RESOLVED]: {
    en: {
      title: "Support Ticket Resolved",
      message: "A response has been registered for your inquiry: {{ticketSubject}}.",
    },
    ko: {
      title: "문의 답변 완료",
      message: "문의하신 [{{ticketSubject}}]에 대한 답변이 등록되었습니다.",
    },
  },

  // 5. Referral
  [NotificationEventType.REFERRAL_JOINED]: {
    en: {
      title: "Referral Joined",
      message: "Your friend {{friendName}} signed up using your code!",
    },
    ko: {
      title: "친구 초대 성공",
      message: "친구 {{friendName}}님이 고객님의 코드로 가입했습니다!",
    },
  },
  [NotificationEventType.REFERRAL_REWARDED]: {
    en: {
      title: "Referral Reward",
      message: "You have received a referral reward of {{rewardAmount}} {{currency}}.",
    },
    ko: {
      title: "추천 리워드 지급",
      message: "친구 초대 리워드 {{rewardAmount}} {{currency}}이 지급되었습니다.",
    },
  },

  // 6. Security
  [NotificationEventType.FDS_ALERT]: {
    en: {
      title: "Fraud Detection Alert",
      message: "Unusual transfer attempt of {{amount}} detected on your account.",
    },
    ko: {
      title: "이상 거래 탐지",
      message: "계정에서 {{amount}}의 비정상적인 거래 시도가 탐지되었습니다.",
    },
  },
  [NotificationEventType.NEW_DEVICE_LOGIN]: {
    en: {
      title: "New Device Login",
      message: "A login occurred from a new device: {{deviceModel}}.",
    },
    ko: {
      title: "새 기기 로그인",
      message: "새로운 기기({{deviceModel}})에서 로그인이 발생했습니다.",
    },
  },
  [NotificationEventType.SUSPICIOUS_TRANSFER]: {
    en: {
      title: "Suspicious Transfer Blocked",
      message: "A suspicious transfer attempt of {{amount}} to {{recipientName}} was blocked for your safety.",
    },
    ko: {
      title: "의심 거래 차단",
      message: "고객님의 안전을 위해 {{recipientName}}님께 보내는 {{amount}} 송금 시도가 차단되었습니다.",
    },
  },

  // 7. System & Admin Audit
  [NotificationEventType.SYSTEM_DOWNTIME]: {
    en: {
      title: "System Error: Downtime Alert",
      message: "Node {{node|API Gateway}} is reporting {{lossRate|98%}} packet loss.",
    },
    ko: {
      title: "시스템 장애 알림",
      message: "노드 {{node|API Gateway}}에서 {{lossRate|98%}} 패킷 손실이 보고되었습니다.",
    },
  },
  [NotificationEventType.AUDIT_SENSITIVE_ACCESS]: {
    en: {
      title: "Sensitive Access Alert",
      message: "Warning: Admin ({{adminName}}) accessed {{resourceName|sensitive area}} from IP: {{ipAddress}}.",
    },
    ko: {
      title: "민감 정보 접근 알림",
      message: "관리자 ({{adminName}})가 IP {{ipAddress}}에서 민감 정보에 접근했습니다.",
    },
  },
  [NotificationEventType.AUDIT_ACCOUNT_CREATION]: {
    en: {
      title: "Admin Account Activity",
      message: "A new admin account has been created/modified. Target: {{targetAccount}}",
    },
    ko: {
      title: "관리자 계정 활동",
      message: "새로운 관리자 계정이 생성되거나 수정되었습니다. 대상: {{targetAccount}}",
    },
  },
  [NotificationEventType.AUDIT_PERSONAL_DATA]: {
    en: {
      title: "Personal Data Access",
      message: "Admin ({{adminName}}) viewed the personal data of customer ({{targetUser}}).",
    },
    ko: {
      title: "개인정보 열람 알림",
      message: "관리자 ({{adminName}})가 고객 ({{targetUser}})의 개인정보를 열람했습니다.",
    },
  },
  [NotificationEventType.AUDIT_CUSTOMER_FUNDS]: {
    en: {
      title: "Customer Funds Manipulation",
      message: "Warning: A forced adjustment of {{amount}} occurred on User: {{targetUser}}.",
    },
    ko: {
      title: "고객 자금 조정 알림",
      message: "경고: 고객 ({{targetUser}})의 자금이 {{amount}}만큼 강제 조정되었습니다.",
    },
  },
  [NotificationEventType.AUDIT_FX_DEPOSIT]: {
    en: {
      title: "FX Deposit Update",
      message: "The system FX Deposit setting was changed by Admin: {{adminName}}.",
    },
    ko: {
      title: "FX 입금 설정 변경",
      message: "관리자 ({{adminName}})에 의해 시스템 FX 입금 설정이 변경되었습니다.",
    },
  },
};

export const TEMPLATE_META: Record<NotificationEventType, TemplateMeta> = {
  [NotificationEventType.KYC_PENDING]: { defaultSysCode: "#KYC-001", priority: NOTIFICATION_PRIORITY.HIGH },
  [NotificationEventType.KYC_REJECTED]: { defaultSysCode: "#KYC-002", priority: NOTIFICATION_PRIORITY.URGENT },
  [NotificationEventType.KYC_APPROVED]: { defaultSysCode: "#KYC-003", priority: NOTIFICATION_PRIORITY.MEDIUM },
  [NotificationEventType.KYC_REVERIFICATION_REQUIRED]: {
    defaultSysCode: "#KYC-005",
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
  [NotificationEventType.KYC_REVERIFICATION_REQUIRED_ADMIN]: {
    defaultSysCode: "#KYC-006",
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
  [NotificationEventType.KYC_REVERIFICATION_SUCCESS]: {
    defaultSysCode: "#KYC-007",
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
  [NotificationEventType.KYC_REVERIFICATION_SUSPENDED]: {
    defaultSysCode: "#KYC-004",
    priority: NOTIFICATION_PRIORITY.URGENT,
  },
  [NotificationEventType.REMITTANCE_PROCESSING]: { defaultSysCode: "#REM-001", priority: NOTIFICATION_PRIORITY.HIGH },
  [NotificationEventType.REMITTANCE_DELAYED]: { defaultSysCode: "#REM-002", priority: NOTIFICATION_PRIORITY.URGENT },
  [NotificationEventType.REMITTANCE_FAILED]: { defaultSysCode: "#REM-003", priority: NOTIFICATION_PRIORITY.URGENT },
  [NotificationEventType.REMITTANCE_COMPLETED]: { defaultSysCode: "#REM-004", priority: NOTIFICATION_PRIORITY.HIGH },
  [NotificationEventType.LIMIT_WARNING]: { defaultSysCode: "#LMT-001", priority: NOTIFICATION_PRIORITY.MEDIUM },
  [NotificationEventType.FX_ALERT]: { defaultSysCode: "#FX-001", priority: NOTIFICATION_PRIORITY.MEDIUM },
  [NotificationEventType.TICKET_RECEIVED]: { defaultSysCode: "#TKT-001", priority: NOTIFICATION_PRIORITY.LOW },
  [NotificationEventType.TICKET_RESOLVED]: { defaultSysCode: "#TKT-002", priority: NOTIFICATION_PRIORITY.HIGH },
  [NotificationEventType.REFERRAL_JOINED]: { defaultSysCode: "#REF-001", priority: NOTIFICATION_PRIORITY.LOW },
  [NotificationEventType.REFERRAL_REWARDED]: { defaultSysCode: "#REF-002", priority: NOTIFICATION_PRIORITY.LOW },
  [NotificationEventType.FDS_ALERT]: { defaultSysCode: "#SEC-FDS", priority: NOTIFICATION_PRIORITY.URGENT },
  [NotificationEventType.NEW_DEVICE_LOGIN]: { defaultSysCode: "#SEC-LOG", priority: NOTIFICATION_PRIORITY.HIGH },
  [NotificationEventType.SUSPICIOUS_TRANSFER]: { defaultSysCode: "#SEC-SUS", priority: NOTIFICATION_PRIORITY.URGENT },
  [NotificationEventType.SYSTEM_DOWNTIME]: { defaultSysCode: "#SYS-082", priority: NOTIFICATION_PRIORITY.URGENT },
  [NotificationEventType.AUDIT_SENSITIVE_ACCESS]: {
    defaultSysCode: "#AUD-SEN",
    priority: NOTIFICATION_PRIORITY.URGENT,
  },
  [NotificationEventType.AUDIT_ACCOUNT_CREATION]: {
    defaultSysCode: "#AUD-ACC",
    priority: NOTIFICATION_PRIORITY.URGENT,
  },
  [NotificationEventType.AUDIT_PERSONAL_DATA]: { defaultSysCode: "#AUD-PRV", priority: NOTIFICATION_PRIORITY.HIGH },
  [NotificationEventType.AUDIT_CUSTOMER_FUNDS]: { defaultSysCode: "#AUD-FND", priority: NOTIFICATION_PRIORITY.URGENT },
  [NotificationEventType.AUDIT_FX_DEPOSIT]: { defaultSysCode: "#AUD-FXD", priority: NOTIFICATION_PRIORITY.HIGH },
};

export const DEFAULT_TEMPLATE_TEXT: LocaleText = {
  en: { title: "Notification", message: "A new notification has arrived." },
  ko: { title: "알림", message: "새로운 알림이 도착했습니다." },
};

export const DEFAULT_TEMPLATE_META: TemplateMeta = {
  defaultSysCode: "#GEN-000",
  priority: NOTIFICATION_PRIORITY.LOW,
};

// Alimtalk (KAKAO) must match the NCP console template, so it never reads DB copy.
export const DB_EXTERNALIZED_EXCLUDED_CHANNEL = "KAKAO";

// Fills `{{key}}` / `{{key|default}}` from the payload (empty value → default or "").
export function interpolate(template: string, payload: Record<string, unknown> | null | undefined): string {
  return template.replace(/\{\{\s*([\w.]+)\s*(?:\|([^}]*))?\}\}/g, (_match, key: string, def?: string) => {
    // Resolve dotted keys (e.g. {{user.name}}) by walking the payload.
    const value = key
      .split(".")
      .reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], payload);
    if (value === undefined || value === null || value === "") {
      return def ?? "";
    }
    return String(value);
  });
}

// Lists the `{{variables}}` used by an event's copy (shown to admin editors).
export function extractVariables(type: NotificationEventType): string[] {
  const text = TEMPLATE_TEXT[type];
  if (!text) return [];
  const found = new Set<string>();
  for (const locale of ["en", "ko"] as const) {
    for (const field of [text[locale].title, text[locale].message]) {
      // Fresh regex per field — a shared /g regex carries lastIndex between execs and skips matches.
      const re = /\{\{\s*([\w.]+)\s*(?:\|[^}]*)?\}\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(field)) !== null) {
        found.add(m[1]);
      }
    }
  }
  return Array.from(found);
}
