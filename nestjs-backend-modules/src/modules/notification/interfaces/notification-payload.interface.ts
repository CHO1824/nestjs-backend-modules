/**
 * Strictly defined payload structures for each notification event type.
 *
 * The discriminated union `NotificationEvent` and mapping `NotificationPayloadByType`
 * bind each `NotificationEventType` value to its exact payload shape so callers,
 * templates, and validators all agree at compile time.
 */
import { NotificationEventType } from "../constants/notification.constants";

// ==========================================
// 1. KYC
// ==========================================

export interface KycPendingPayload {
  userName: string;
}

export interface KycRejectedPayload {
  reason: string;
}

export interface KycApprovedPayload {
  userName: string;
  approvedAt: Date;
}

// ==========================================
// 2. Remittance
// ==========================================

export interface RemittanceProcessingPayload {
  amount: number;
  currency: string;
  recipientName: string;
}

export interface RemittanceDelayedPayload {
  recipientName: string;
}

export interface RemittanceFailedPayload {
  transferId: string;
  amount: number;
  currency: string;
  recipientName: string;
  reason: string;
  // deepLink is injected by the UseCase layer when present.
  deepLink?: string;
}

export interface RemittanceCompletedPayload {
  amount: number;
  currency: string;
  recipientName: string;
}

// ==========================================
// 3. Limit & FX
// ==========================================

export interface LimitWarningPayload {
  remainingLimit: number;
}

export interface FxAlertPayload {
  currency: string;
  targetRate: number;
  currentRate: number;
}

// ==========================================
// 4. Support
// ==========================================

export interface TicketReceivedPayload {
  ticketId: string;
}

export interface TicketResolvedPayload {
  ticketSubject: string;
}

// ==========================================
// 5. Referral
// ==========================================

export interface ReferralJoinedPayload {
  friendName: string;
}

export interface ReferralRewardedPayload {
  rewardAmount: number;
  currency: string;
}

// ==========================================
// 6. Security
// ==========================================

export interface FdsAlertPayload {
  amount: number;
}

export interface NewDeviceLoginPayload {
  deviceModel: string;
}

export interface SuspiciousTransferPayload {
  amount: number;
  recipientName: string;
}

// ==========================================
// 7. System & Admin Audit
// ==========================================

export interface SystemDowntimePayload {
  node?: string;
  lossRate?: string;
  sysCode?: string;
}

export interface AuditSensitiveAccessPayload {
  adminName: string;
  ipAddress: string;
  resourceName?: string;
  sysCode?: string;
}

export interface AuditAccountCreationPayload {
  targetAccount: string;
  sysCode?: string;
}

export interface AuditPersonalDataPayload {
  adminName: string;
  targetUser: string;
  sysCode?: string;
}

export interface AuditCustomerFundsPayload {
  amount: number;
  targetUser: string;
  sysCode?: string;
}

export interface AuditFxDepositPayload {
  adminName: string;
  sysCode?: string;
}

// ==========================================
// 8. Mapping & Discriminated Union
// ==========================================

/**
 * Maps each event type to its exact payload shape.
 * Used by templates, validators, and typed publish overloads to enforce
 * structural correctness at compile time.
 */
export interface NotificationPayloadByType {
  [NotificationEventType.KYC_PENDING]: KycPendingPayload;
  [NotificationEventType.KYC_REJECTED]: KycRejectedPayload;
  [NotificationEventType.KYC_APPROVED]: KycApprovedPayload;
  [NotificationEventType.REMITTANCE_PROCESSING]: RemittanceProcessingPayload;
  [NotificationEventType.REMITTANCE_DELAYED]: RemittanceDelayedPayload;
  [NotificationEventType.REMITTANCE_FAILED]: RemittanceFailedPayload;
  [NotificationEventType.REMITTANCE_COMPLETED]: RemittanceCompletedPayload;
  [NotificationEventType.LIMIT_WARNING]: LimitWarningPayload;
  [NotificationEventType.FX_ALERT]: FxAlertPayload;
  [NotificationEventType.TICKET_RECEIVED]: TicketReceivedPayload;
  [NotificationEventType.TICKET_RESOLVED]: TicketResolvedPayload;
  [NotificationEventType.REFERRAL_JOINED]: ReferralJoinedPayload;
  [NotificationEventType.REFERRAL_REWARDED]: ReferralRewardedPayload;
  [NotificationEventType.FDS_ALERT]: FdsAlertPayload;
  [NotificationEventType.NEW_DEVICE_LOGIN]: NewDeviceLoginPayload;
  [NotificationEventType.SUSPICIOUS_TRANSFER]: SuspiciousTransferPayload;
  [NotificationEventType.SYSTEM_DOWNTIME]: SystemDowntimePayload;
  [NotificationEventType.AUDIT_SENSITIVE_ACCESS]: AuditSensitiveAccessPayload;
  [NotificationEventType.AUDIT_ACCOUNT_CREATION]: AuditAccountCreationPayload;
  [NotificationEventType.AUDIT_PERSONAL_DATA]: AuditPersonalDataPayload;
  [NotificationEventType.AUDIT_CUSTOMER_FUNDS]: AuditCustomerFundsPayload;
  [NotificationEventType.AUDIT_FX_DEPOSIT]: AuditFxDepositPayload;
}

/**
 * Union of every supported notification payload shape.
 */
export type NotificationPayload = NotificationPayloadByType[NotificationEventType];

/**
 * Discriminated union of (eventType, payload) pairs. Use this when accepting a
 * publish request from a typed caller — TypeScript narrows `payload` to the
 * exact shape based on the `type` discriminator.
 */
export type NotificationEvent = {
  [K in NotificationEventType]: { type: K; payload: NotificationPayloadByType[K] };
}[NotificationEventType];
