import { Injectable } from "@nestjs/common";
import { NotificationEventType, NOTIFICATION_PRIORITY } from "../constants/notification.constants";
import { NotificationPayloadByType } from "../interfaces/notification-payload.interface";
import { RenderedContent } from "../interfaces/notification-sender.interface";

type SupportedLocale = "en" | "ko";

type TemplateRenderer<T extends NotificationEventType> = (p: NotificationPayloadByType[T]) => RenderedContent;

type LocaleTemplates<T extends NotificationEventType> = {
  [L in SupportedLocale]: TemplateRenderer<T>;
};

/**
 * Mapped-type registry — each event type is bound to renderers that accept
 * the exact payload shape declared in `NotificationPayloadByType`.
 */
type TypedTemplateRegistry = {
  [K in NotificationEventType]: LocaleTemplates<K>;
};

const TYPED_REGISTRY: TypedTemplateRegistry = {
  // ==========================================
  // 1. KYC (Identity Verification)
  // ==========================================
  [NotificationEventType.KYC_PENDING]: {
    en: (p) => ({
      title: "KYC Documents Required",
      message: `Hello ${p.userName || "User"}, additional photos of your ID are required for verification.`,
      sysCode: "#KYC-001",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
    ko: (p) => ({
      title: "KYC Documents Required",
      message: `안녕하세요 ${p.userName || "고객"}님, 신분증 사진 추가 제출이 필요합니다.`,
      sysCode: "#KYC-001",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
  },
  [NotificationEventType.KYC_REJECTED]: {
    en: (p) => ({
      title: "KYC Rejected",
      message: `Your verification was rejected. Reason: ${p.reason || "Invalid documents"}.`,
      sysCode: "#KYC-002",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
    ko: (p) => ({
      title: "KYC Rejected",
      message: `본인 인증이 거절되었습니다. 사유: ${p.reason || "서류 불충분"}.`,
      sysCode: "#KYC-002",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
  },
  [NotificationEventType.KYC_APPROVED]: {
    en: (p) => ({
      title: "KYC Approved",
      message: `Congratulations ${p.userName || ""}! Your identity verification is complete.`,
      sysCode: "#KYC-003",
      priority: NOTIFICATION_PRIORITY.MEDIUM,
    }),
    ko: (p) => ({
      title: "KYC Approved",
      message: `축하합니다 ${p.userName || ""}님! 본인 인증이 완료되었습니다.`,
      sysCode: "#KYC-003",
      priority: NOTIFICATION_PRIORITY.MEDIUM,
    }),
  },

  // ==========================================
  // 2. Remittance (Overseas Transfer)
  // ==========================================
  [NotificationEventType.REMITTANCE_PROCESSING]: {
    en: (p) => ({
      title: "Transfer Processing",
      message: `The transfer of ${p.amount} ${p.currency || ""} to ${p.recipientName} has started.`,
      sysCode: "#REM-001",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
    ko: (p) => ({
      title: "Transfer Processing",
      message: `${p.recipientName}님께 보내는 ${p.amount} ${p.currency || ""} 송금이 시작되었습니다.`,
      sysCode: "#REM-001",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
  },
  [NotificationEventType.REMITTANCE_DELAYED]: {
    en: (p) => ({
      title: "Transfer Delayed",
      message: `Transfer to ${p.recipientName} is delayed due to bank maintenance.`,
      sysCode: "#REM-002",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
    ko: (p) => ({
      title: "Transfer Delayed",
      message: `${p.recipientName}님께 보내는 송금이 은행 점검으로 인해 지연되고 있습니다.`,
      sysCode: "#REM-002",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
  },
  [NotificationEventType.REMITTANCE_FAILED]: {
    en: (p) => ({
      title: "Transfer Failed",
      message: `The transfer of ${p.amount} failed. Reason: ${p.reason || "Account mismatch"}.`,
      sysCode: "#REM-003",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
    ko: (p) => ({
      title: "Transfer Failed",
      message: `${p.amount} 송금이 실패하였습니다. 사유: ${p.reason || "계좌 정보 불일치"}.`,
      sysCode: "#REM-003",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
  },
  [NotificationEventType.REMITTANCE_COMPLETED]: {
    en: (p) => ({
      title: "Transfer Completed",
      message: `Transfer of ${p.amount} to ${p.recipientName} has been successfully completed.`,
      sysCode: "#REM-004",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
    ko: (p) => ({
      title: "Transfer Completed",
      message: `${p.recipientName}님께 보내는 ${p.amount} 송금이 성공적으로 완료되었습니다.`,
      sysCode: "#REM-004",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
  },

  // ==========================================
  // 3. Limit & FX Management
  // ==========================================
  [NotificationEventType.LIMIT_WARNING]: {
    en: (p) => ({
      title: "Limit Warning",
      message: `Your remaining transfer limit for this year is ${p.remainingLimit}.`,
      sysCode: "#LMT-001",
      priority: NOTIFICATION_PRIORITY.MEDIUM,
    }),
    ko: (p) => ({
      title: "한도 경고",
      message: `올해 잔여 송금 한도는 ${p.remainingLimit} 입니다.`,
      sysCode: "#LMT-001",
      priority: NOTIFICATION_PRIORITY.MEDIUM,
    }),
  },
  [NotificationEventType.FX_ALERT]: {
    en: (p) => ({
      title: "Target FX Reached",
      message: `The ${p.currency} rate has reached your target of ${p.targetRate}!`,
      sysCode: "#FX-001",
      priority: NOTIFICATION_PRIORITY.MEDIUM,
    }),
    ko: (p) => ({
      title: "목표 환율 도달",
      message: `${p.currency} 환율이 설정하신 목표치 ${p.targetRate}에 도달했습니다!`,
      sysCode: "#FX-001",
      priority: NOTIFICATION_PRIORITY.MEDIUM,
    }),
  },

  // ==========================================
  // 4. Support Ticket
  // ==========================================
  [NotificationEventType.TICKET_RECEIVED]: {
    en: (p) => ({
      title: "Support Ticket Received",
      message: `Your inquiry [${p.ticketId || ""}] has been successfully received.`,
      sysCode: "#TKT-001",
      priority: NOTIFICATION_PRIORITY.LOW,
    }),
    ko: (p) => ({
      title: "문의 접수 완료",
      message: `문의하신 내역 [${p.ticketId || ""}]이 정상적으로 접수되었습니다.`,
      sysCode: "#TKT-001",
      priority: NOTIFICATION_PRIORITY.LOW,
    }),
  },
  [NotificationEventType.TICKET_RESOLVED]: {
    en: (p) => ({
      title: "Support Ticket Resolved",
      message: `A response has been registered for your inquiry: ${p.ticketSubject}.`,
      sysCode: "#TKT-002",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
    ko: (p) => ({
      title: "문의 답변 완료",
      message: `문의하신 [${p.ticketSubject}]에 대한 답변이 등록되었습니다.`,
      sysCode: "#TKT-002",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
  },

  // ==========================================
  // 5. Referral
  // ==========================================
  [NotificationEventType.REFERRAL_JOINED]: {
    en: (p) => ({
      title: "Referral Joined",
      message: `Your friend ${p.friendName || ""} signed up using your code!`,
      sysCode: "#REF-001",
      priority: NOTIFICATION_PRIORITY.LOW,
    }),
    ko: (p) => ({
      title: "친구 초대 성공",
      message: `친구 ${p.friendName || ""}님이 고객님의 코드로 가입했습니다!`,
      sysCode: "#REF-001",
      priority: NOTIFICATION_PRIORITY.LOW,
    }),
  },
  [NotificationEventType.REFERRAL_REWARDED]: {
    en: (p) => ({
      title: "Referral Reward",
      message: `You have received a referral reward of ${p.rewardAmount} ${p.currency}.`,
      sysCode: "#REF-002",
      priority: NOTIFICATION_PRIORITY.LOW,
    }),
    ko: (p) => ({
      title: "추천 리워드 지급",
      message: `친구 초대 리워드 ${p.rewardAmount} ${p.currency}이 지급되었습니다.`,
      sysCode: "#REF-002",
      priority: NOTIFICATION_PRIORITY.LOW,
    }),
  },

  // ==========================================
  // 6. Security
  // ==========================================
  [NotificationEventType.FDS_ALERT]: {
    en: (p) => ({
      title: "Fraud Detection Alert",
      message: `Unusual transfer attempt of ${p.amount} detected on your account.`,
      sysCode: "#SEC-FDS",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
    ko: (p) => ({
      title: "이상 거래 탐지",
      message: `계정에서 ${p.amount}의 비정상적인 거래 시도가 탐지되었습니다.`,
      sysCode: "#SEC-FDS",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
  },
  [NotificationEventType.NEW_DEVICE_LOGIN]: {
    en: (p) => ({
      title: "New Device Login",
      message: `A login occurred from a new device: ${p.deviceModel}.`,
      sysCode: "#SEC-LOG",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
    ko: (p) => ({
      title: "새 기기 로그인",
      message: `새로운 기기(${p.deviceModel})에서 로그인이 발생했습니다.`,
      sysCode: "#SEC-LOG",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
  },
  [NotificationEventType.SUSPICIOUS_TRANSFER]: {
    en: (p) => ({
      title: "Suspicious Transfer Blocked",
      message: `A suspicious transfer attempt of ${p.amount} to ${p.recipientName} was blocked for your safety.`,
      sysCode: "#SEC-SUS",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
    ko: (p) => ({
      title: "의심 거래 차단",
      message: `고객님의 안전을 위해 ${p.recipientName}님께 보내는 ${p.amount} 송금 시도가 차단되었습니다.`,
      sysCode: "#SEC-SUS",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
  },

  // ==========================================
  // 7. System & Admin Audit
  // ==========================================
  [NotificationEventType.SYSTEM_DOWNTIME]: {
    en: (p) => ({
      title: "System Error: Downtime Alert",
      message: `Node ${p.node || "API Gateway"} is reporting ${p.lossRate || "98%"} packet loss.`,
      sysCode: p.sysCode || "#SYS-082",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
    ko: (p) => ({
      title: "시스템 장애 알림",
      message: `노드 ${p.node || "API Gateway"}에서 ${p.lossRate || "98%"} 패킷 손실이 보고되었습니다.`,
      sysCode: p.sysCode || "#SYS-082",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
  },
  [NotificationEventType.AUDIT_SENSITIVE_ACCESS]: {
    en: (p) => ({
      title: "Sensitive Access Alert",
      message: `Warning: Admin (${p.adminName}) accessed ${p.resourceName || "sensitive area"} from IP: ${p.ipAddress}.`,
      sysCode: p.sysCode || "#AUD-SEN",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
    ko: (p) => ({
      title: "민감 정보 접근 알림",
      message: `관리자 (${p.adminName})가 IP ${p.ipAddress}에서 민감 정보에 접근했습니다.`,
      sysCode: p.sysCode || "#AUD-SEN",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
  },
  [NotificationEventType.AUDIT_ACCOUNT_CREATION]: {
    en: (p) => ({
      title: "Admin Account Activity",
      message: `A new admin account has been created/modified. Target: ${p.targetAccount}`,
      sysCode: p.sysCode || "#AUD-ACC",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
    ko: (p) => ({
      title: "관리자 계정 활동",
      message: `새로운 관리자 계정이 생성되거나 수정되었습니다. 대상: ${p.targetAccount}`,
      sysCode: p.sysCode || "#AUD-ACC",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
  },
  [NotificationEventType.AUDIT_PERSONAL_DATA]: {
    en: (p) => ({
      title: "Personal Data Access",
      message: `Admin (${p.adminName}) viewed the personal data of customer (${p.targetUser}).`,
      sysCode: p.sysCode || "#AUD-PRV",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
    ko: (p) => ({
      title: "개인정보 열람 알림",
      message: `관리자 (${p.adminName})가 고객 (${p.targetUser})의 개인정보를 열람했습니다.`,
      sysCode: p.sysCode || "#AUD-PRV",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
  },
  [NotificationEventType.AUDIT_CUSTOMER_FUNDS]: {
    en: (p) => ({
      title: "Customer Funds Manipulation",
      message: `Warning: A forced adjustment of ${p.amount} occurred on User: ${p.targetUser}.`,
      sysCode: p.sysCode || "#AUD-FND",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
    ko: (p) => ({
      title: "고객 자금 조정 알림",
      message: `경고: 고객 (${p.targetUser})의 자금이 ${p.amount}만큼 강제 조정되었습니다.`,
      sysCode: p.sysCode || "#AUD-FND",
      priority: NOTIFICATION_PRIORITY.URGENT,
    }),
  },
  [NotificationEventType.AUDIT_FX_DEPOSIT]: {
    en: (p) => ({
      title: "FX Deposit Update",
      message: `The system FX Deposit setting was changed by Admin: ${p.adminName}.`,
      sysCode: p.sysCode || "#AUD-FXD",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
    ko: (p) => ({
      title: "FX 입금 설정 변경",
      message: `관리자 (${p.adminName})에 의해 시스템 FX 입금 설정이 변경되었습니다.`,
      sysCode: p.sysCode || "#AUD-FXD",
      priority: NOTIFICATION_PRIORITY.HIGH,
    }),
  },
};

/**
 * Default fallback used when an unknown event type slips through.
 * Receives an opaque payload (validators upstream are expected to reject
 * unknown types before we reach this point) and only relies on a generic
 * `message` field if present.
 */
const DEFAULT_TEMPLATE: LocaleTemplates<NotificationEventType.KYC_PENDING> = {
  en: () => ({
    title: "Notification",
    message: "A new notification has arrived.",
    sysCode: "#GEN-000",
    priority: NOTIFICATION_PRIORITY.LOW,
  }),
  ko: () => ({
    title: "알림",
    message: "새로운 알림이 도착했습니다.",
    sysCode: "#GEN-000",
    priority: NOTIFICATION_PRIORITY.LOW,
  }),
};

@Injectable()
export class NotificationTemplateService {
  exists(type: string): type is NotificationEventType {
    return Object.prototype.hasOwnProperty.call(TYPED_REGISTRY, type);
  }

  /**
   * Resolves the localized renderer for the given event type and invokes it
   * with the typed payload. Callers must validate the payload shape before
   * reaching this method — see `validateNotificationPayload`.
   */
  render<T extends NotificationEventType>(
    type: T,
    payload: NotificationPayloadByType[T],
    locale: string = "en",
  ): RenderedContent {
    const templates = TYPED_REGISTRY[type] ?? DEFAULT_TEMPLATE;
    const normalizedLocale: SupportedLocale = locale === "ko" ? "ko" : "en";
    const renderer = templates[normalizedLocale] ?? templates.en;
    return (renderer as TemplateRenderer<T>)(payload);
  }
}
