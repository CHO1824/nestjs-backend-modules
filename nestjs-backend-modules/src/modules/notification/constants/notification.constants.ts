/**
 * Category for legal compliance and consent logic.
 */
export enum NotificationCategory {
  TRANSACTIONAL = "TRANSACTIONAL",
  MARKETING = "MARKETING",
}

/**
 * Supported delivery channels.
 */
export enum DeliveryChannel {
  EMAIL = "EMAIL",
  PUSH = "PUSH",
  ALIMTALK = "ALIMTALK",
  SMS = "SMS",
  KAKAO = "KAKAO",
}

/**
 * Standardized event types.
 * Use this Enum as the single source of truth for all template IDs.
 */
export enum NotificationEventType {
  KYC_PENDING = "kyc.pending",
  KYC_REJECTED = "kyc.rejected",
  KYC_APPROVED = "kyc.approved",
  KYC_REVERIFICATION_REQUIRED = "kyc.reverification_required",
  KYC_REVERIFICATION_REQUIRED_ADMIN = "kyc.reverification_required_admin",
  KYC_REVERIFICATION_SUCCESS = "kyc.reverification_success",
  KYC_REVERIFICATION_SUSPENDED = "kyc.reverification_suspended",
  REMITTANCE_PROCESSING = "remittance.processing",
  REMITTANCE_DELAYED = "remittance.delayed",
  REMITTANCE_FAILED = "remittance.failed",
  REMITTANCE_COMPLETED = "remittance.completed",
  LIMIT_WARNING = "security.limit_warning",
  FX_ALERT = "convenience.fx_alert",
  TICKET_RECEIVED = "ticket.received",
  TICKET_RESOLVED = "ticket.resolved",
  REFERRAL_JOINED = "referral.joined",
  REFERRAL_REWARDED = "referral.rewarded",
  FDS_ALERT = "security.fds_alert",
  NEW_DEVICE_LOGIN = "security.new_device",
  SUSPICIOUS_TRANSFER = "security.suspicious_transfer",
  SYSTEM_DOWNTIME = "admin.system_downtime",
  AUDIT_SENSITIVE_ACCESS = "admin.audit.sensitive_access",
  AUDIT_ACCOUNT_CREATION = "admin.audit.account_creation",
  AUDIT_PERSONAL_DATA = "admin.audit.personal_data",
  AUDIT_CUSTOMER_FUNDS = "admin.audit.customer_funds",
  AUDIT_FX_DEPOSIT = "admin.audit.fx_deposit",

  // ────────────────────────────────────────────────────────────────────────
  // 🚨 [COMPLIANCE WARNING] MVP-blocked — prepaid e-money / PG license not obtained
  // ────────────────────────────────────────────────────────────────────────
  // Under the Korean Electronic Financial Transactions Act, sending wallet
  // deposit/withdrawal notifications requires prior license registration.
  // Sending these events without the license constitutes operating an
  // unauthorized financial service and is subject to legal penalties.
  //
  // TODO: [TICKET-ID] Legal approval required before enabling.
  // When enabling: uncomment the entries below AND implement the required
  // templates and dispatch logic in the respective services.
  // DO NOT enable until explicit clearance from the legal team.
  //
  // DEPOSIT_SUCCESS = "deposit.success",
  // WITHDRAWAL_SUCCESS = "withdrawal.success",
}

/**
 * Exporting NotificationEventType as NOTIFICATION_TEMPLATES for backward compatibility
 * or specific template mapping logic.
 */
export const NOTIFICATION_TEMPLATES = NotificationEventType;

/**
 * Internal processing status for the Outbox worker.
 */
export const NOTIFICATION_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SENT: "SENT",
  RETRY_WAIT: "RETRY_WAIT",
  FAILED: "FAILED",
  SKIPPED_BY_POLICY: "SKIPPED_BY_POLICY",
} as const;

/**
 * Priority levels based on the Admin UI design specifications.
 */
export const NOTIFICATION_PRIORITY = {
  URGENT: "URGENT",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;
