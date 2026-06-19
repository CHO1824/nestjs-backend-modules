import { Test, TestingModule } from "@nestjs/testing";

import {
  DeliveryChannel,
  NOTIFICATION_PRIORITY,
  NotificationCategory,
  NotificationEventType,
} from "./constants/notification.constants";
import { CreateNotificationDto } from "./dto/notification.dto";
import {
  IdempotencyConflictError,
  NotificationNotFoundError,
  NotificationNotOwnedError,
} from "./errors/notification.errors";
import { NotificationRepository } from "./notification.repository";
import { NotificationService } from "./notification.service";
import { NotificationPolicyService } from "./services/notification-policy.service";
import { NotificationTemplateService } from "./services/notification-template.service";

// Minimal interface for Transactional Client to prevent type errors
interface MockTransaction {
  $executeRaw: jest.Mock;
}

interface MockUserContext {
  id: string;
  email: string;
  locale: string;
  marketingOptInAt: Date | null;
  devices: { token: string; isActive: boolean }[];
  preferences: { channel: DeliveryChannel; isOptIn: boolean }[];
}

describe("NotificationService", () => {
  let service: NotificationService;
  let mockRepo: Record<string, jest.Mock>;
  let mockTemplateService: Record<string, jest.Mock>;
  let mockPolicyService: { isAllowed: jest.Mock };

  beforeEach(async () => {
    // Mock Repository with User Context resolution
    mockRepo = {
      findUserContext: jest.fn().mockImplementation((userId: string) => {
        if (userId === "non-existent") return null;

        return {
          id: userId,
          email: "dev@vpay.com",
          locale: "en",
          // 'unconsented-user' has no marketing consent (null)
          marketingOptInAt: userId === "unconsented-user" ? null : new Date(),
          devices: [
            { token: "fcm-token-active", isActive: true },
            { token: "fcm-token-inactive", isActive: false },
          ],
          preferences: [
            { channel: DeliveryChannel.PUSH, isOptIn: true },
            { channel: DeliveryChannel.EMAIL, isOptIn: true },
          ],
        };
      }),
      createOutbox: jest.fn().mockImplementation((data) => ({ ...data, id: "outbox-uuid" })),
      createNotification: jest.fn().mockResolvedValue({ id: "notif-uuid" }),
      // Default: key is fresh (publish proceeds). Duplicate/conflict tests override per-case.
      reserveIdempotency: jest.fn().mockResolvedValue("RESERVED"),
      findById: jest.fn(),
      markAsRead: jest.fn().mockResolvedValue(undefined),
      deleteUserNotification: jest.fn().mockResolvedValue(undefined),
    };

    // Mock Template Service for rendering logic
    mockTemplateService = {
      render: jest.fn().mockReturnValue({
        title: "Test Title",
        message: "Test Message",
        priority: NOTIFICATION_PRIORITY.HIGH, // Maps to 7
      }),
      exists: jest.fn().mockReturnValue(true),
    };

    // Mock Policy Service: TRANSACTIONAL always allowed; MARKETING gated by marketingOptInAt
    mockPolicyService = {
      isAllowed: jest.fn((user: MockUserContext, category: string) => {
        if (category === NotificationCategory.TRANSACTIONAL) return true;
        if (category === NotificationCategory.MARKETING) return Boolean(user?.marketingOptInAt);
        return true;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: NotificationRepository, useValue: mockRepo },
        { provide: NotificationTemplateService, useValue: mockTemplateService },
        { provide: NotificationPolicyService, useValue: mockPolicyService },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  /**
   * Test Case 1: Verifies that TRANSACTIONAL events (e.g., Remittance, KYC)
   * are delivered even if the user has not provided marketing consent.
   */
  it("should publish TRANSACTIONAL events regardless of marketing consent", async () => {
    const userId = "unconsented-user";
    const dto: CreateNotificationDto = {
      channels: [DeliveryChannel.EMAIL, DeliveryChannel.PUSH],
      category: NotificationCategory.TRANSACTIONAL,
      type: NotificationEventType.KYC_APPROVED,
      payload: { userName: "Test User", approvedAt: new Date().toISOString() },
    };

    const result = await service.publish(userId, dto);

    // Verify 1 Email + 1 Active Push Token = 2 records
    expect(result).toHaveLength(2);
    expect(mockRepo.createOutbox).toHaveBeenCalled();
  });

  /**
   * Test Case 2: Ensures that MARKETING category events are strictly filtered out
   * for users who have not opted into marketing (Compliance check).
   */
  it("should NOT publish MARKETING events to users without marketingOptInAt", async () => {
    const userId = "unconsented-user";
    const dto: CreateNotificationDto = {
      channels: [DeliveryChannel.PUSH],
      category: NotificationCategory.MARKETING,
      // Using an existing type to avoid Enum errors,
      // the 'category' is what triggers the consent check logic.
      type: NotificationEventType.KYC_APPROVED,
      payload: { userName: "Test User", approvedAt: new Date().toISOString() },
    };

    const result = await service.publish(userId, dto);

    // Should not create any outbox records due to lack of consent
    expect(result).toHaveLength(0);
    expect(mockRepo.createOutbox).not.toHaveBeenCalled();
  });

  /** In-app inbox: a TRANSACTIONAL publish records the in-app notification. */
  it("persists an in-app notification for a TRANSACTIONAL publish", async () => {
    const userId = "active-user";
    const dto: CreateNotificationDto = {
      channels: [DeliveryChannel.PUSH],
      category: NotificationCategory.TRANSACTIONAL,
      type: NotificationEventType.REMITTANCE_COMPLETED,
      payload: { amount: 100, currency: "USD", recipientName: "Kim" },
    };

    await service.publish(userId, dto);

    expect(mockRepo.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        type: NotificationEventType.REMITTANCE_COMPLETED,
        title: "Test Title",
        message: "Test Message",
      }),
      undefined,
    );
  });

  /** In-app inbox respects consent: opted-out marketing leaves no record. */
  it("does NOT persist an in-app notification for opted-out MARKETING", async () => {
    const userId = "unconsented-user";
    const dto: CreateNotificationDto = {
      channels: [DeliveryChannel.PUSH],
      category: NotificationCategory.MARKETING,
      type: NotificationEventType.KYC_APPROVED,
      payload: { userName: "Test User", approvedAt: new Date().toISOString() },
    };

    await service.publish(userId, dto);

    expect(mockRepo.createNotification).not.toHaveBeenCalled();
  });

  describe("idempotency key (duplicate-publish guard)", () => {
    const dupDto: CreateNotificationDto = {
      channels: [DeliveryChannel.PUSH],
      category: NotificationCategory.TRANSACTIONAL,
      type: NotificationEventType.REMITTANCE_COMPLETED,
      payload: { amount: 100, currency: "USD", recipientName: "Kim" },
      idempotencyKey: "remittance.completed:transfer-1",
    };

    it("reserves the key and proceeds when it is fresh", async () => {
      const result = await service.publish("active-user", dupDto);

      expect(mockRepo.reserveIdempotency).toHaveBeenCalledWith(
        "remittance.completed:transfer-1",
        expect.any(String),
        expect.any(Date),
        undefined,
      );
      expect(result).toHaveLength(1);
      expect(mockRepo.createOutbox).toHaveBeenCalled();
    });

    it("skips the publish entirely when the key is a duplicate", async () => {
      mockRepo.reserveIdempotency.mockResolvedValueOnce("DUPLICATE");

      const result = await service.publish("active-user", dupDto);

      expect(result).toHaveLength(0);
      expect(mockRepo.createNotification).not.toHaveBeenCalled();
      expect(mockRepo.createOutbox).not.toHaveBeenCalled();
    });

    it("throws a conflict error when the same key is reused with a different body", async () => {
      mockRepo.reserveIdempotency.mockResolvedValueOnce("CONFLICT");

      await expect(service.publish("active-user", dupDto)).rejects.toBeInstanceOf(IdempotencyConflictError);
      expect(mockRepo.createOutbox).not.toHaveBeenCalled();
    });

    it("does not reserve when no idempotency key is supplied", async () => {
      const dto: CreateNotificationDto = {
        channels: [DeliveryChannel.PUSH],
        category: NotificationCategory.TRANSACTIONAL,
        type: NotificationEventType.REMITTANCE_COMPLETED,
        payload: { amount: 100, currency: "USD", recipientName: "Kim" },
      };

      await service.publish("active-user", dto);

      expect(mockRepo.reserveIdempotency).not.toHaveBeenCalled();
    });
  });

  /**
   * Test Case 3: Confirms the 'Atomic Transaction' by verifying that the
   * transaction object (tx) is correctly propagated to the repository.
   */
  it("should pass the transaction object(tx) to repository if provided", async () => {
    const mockTx: MockTransaction = { $executeRaw: jest.fn() };
    const userId = "active-user";
    const dto: CreateNotificationDto = {
      channels: [DeliveryChannel.EMAIL],
      category: NotificationCategory.TRANSACTIONAL,
      type: NotificationEventType.REMITTANCE_COMPLETED,
      payload: { amount: 100, currency: "USD", recipientName: "Kim" },
    };

    await service.publish(userId, dto, undefined, mockTx as unknown as Parameters<typeof service.publish>[3]);

    // Ensure createOutbox is called with the mockTx as the second argument
    expect(mockRepo.createOutbox).toHaveBeenCalledWith(expect.any(Object), mockTx);
  });

  /**
   * Test Case 4: Verifies the logic to filter and resolve only active device tokens
   * while ignoring deactivated or expired FCM tokens.
   */
  it("should resolve only active device tokens for PUSH channel", async () => {
    const userId = "active-user";
    const dto: CreateNotificationDto = {
      channels: [DeliveryChannel.PUSH],
      category: NotificationCategory.TRANSACTIONAL,
      type: NotificationEventType.REMITTANCE_COMPLETED,
      payload: { amount: 100, currency: "USD", recipientName: "Kim" },
    };

    const result = await service.publish(userId, dto);

    // Token present → PUSH only (active token), no Alimtalk; in-app inbox recorded.
    expect(result).toHaveLength(1);
    expect(result[0].channel).toBe("PUSH");
    expect(result[0].targetValue).toBe("fcm-token-active");
    expect(result.some((o) => o.channel === "KAKAO")).toBe(false);
    expect(mockRepo.createNotification).toHaveBeenCalled();
  });

  /** No active device token → PUSH is substituted with Alimtalk (KAKAO) so the user is still reached. */
  it("substitutes KAKAO for PUSH when the user has no active device token", async () => {
    mockRepo.findUserContext.mockResolvedValueOnce({
      id: "no-token-user",
      email: "dev@vpay.com",
      locale: "en",
      marketingOptInAt: new Date(),
      phoneNumber: "01012345678",
      phoneCountryCode: "+82",
      devices: [{ token: "dead-token", isActive: false }], // no active token
      preferences: [{ channel: DeliveryChannel.PUSH, isOptIn: true }],
    });

    const dto: CreateNotificationDto = {
      channels: [DeliveryChannel.PUSH],
      category: NotificationCategory.TRANSACTIONAL,
      type: NotificationEventType.REMITTANCE_COMPLETED,
      payload: { amount: 100, currency: "USD", recipientName: "Kim" },
    };

    const result = await service.publish("no-token-user", dto);

    // No token → no PUSH; routed to KAKAO on the user's phone (0 stripped, +CC prepended);
    // in-app inbox still recorded so the user can also see it on opening the app.
    expect(result).toHaveLength(1);
    expect(result.some((o) => o.channel === "PUSH")).toBe(false);
    expect(result[0].channel).toBe("KAKAO");
    expect(result[0].targetValue).toBe("+821012345678");
    expect(mockRepo.createNotification).toHaveBeenCalled();
  });

  /**
   * Test Case 5: Ensures the system throws a specific business error (RecipientNotFoundError)
   * when trying to send a notification to a non-existent user.
   */
  it("should throw NotFoundException('user_not_found') if user context is missing", async () => {
    const userId = "non-existent";
    const dto: CreateNotificationDto = {
      channels: [DeliveryChannel.EMAIL],
      category: NotificationCategory.TRANSACTIONAL,
      type: NotificationEventType.REMITTANCE_COMPLETED,
      payload: { amount: 100, currency: "USD", recipientName: "Kim" },
    };

    await expect(service.publish(userId, dto)).rejects.toThrow("user_not_found");
  });

  /**
   * Test Case 6: Validates the Localization (i18n) flow by checking if the user's
   * locale preference is correctly passed to the template rendering engine.
   */
  it("should pass the user's locale to the template engine", async () => {
    const userId = "user-uuid";
    const payload = { userName: "kim" };
    const dto: CreateNotificationDto = {
      channels: [DeliveryChannel.EMAIL],
      category: NotificationCategory.TRANSACTIONAL,
      type: NotificationEventType.KYC_PENDING,
      payload,
    };

    await service.publish(userId, dto);

    // Template engine must receive the user's locale ('en') from context
    expect(mockTemplateService.render).toHaveBeenCalledWith(NotificationEventType.KYC_PENDING, payload, "en");
  });

  /**
   * Test Case 7: Verifies the new payload validator rejects structurally
   * invalid payloads at the publish boundary — the core silent-failure guard.
   */
  it("should reject payloads that miss required fields for the event type", async () => {
    const userId = "active-user";
    const dto: CreateNotificationDto = {
      channels: [DeliveryChannel.EMAIL],
      category: NotificationCategory.TRANSACTIONAL,
      type: NotificationEventType.REMITTANCE_COMPLETED,
      // currency and recipientName missing — validator must throw.
      payload: { amount: 100 },
    };

    await expect(service.publish(userId, dto)).rejects.toThrow(/Payload validation failed/);
    expect(mockRepo.createOutbox).not.toHaveBeenCalled();
  });

  /**
   * Ownership tests for verifyOwnership (exercised via markAsRead).
   * Pre-fix, both branches collapsed into a single 500-equivalent error;
   * the contract is now 404 (does not exist) vs 403 (exists, not yours).
   */
  describe("verifyOwnership (via markAsRead)", () => {
    it("throws NotificationNotFoundError (404) when the row does not exist", async () => {
      mockRepo.findById.mockResolvedValueOnce(null);

      await expect(service.markAsRead("user-1", "missing-id")).rejects.toBeInstanceOf(NotificationNotFoundError);
      expect(mockRepo.markAsRead).not.toHaveBeenCalled();
    });

    it("throws NotificationNotOwnedError (403) when the row belongs to another user", async () => {
      mockRepo.findById.mockResolvedValueOnce({ id: "n-1", userId: "user-2" });

      await expect(service.markAsRead("user-1", "n-1")).rejects.toBeInstanceOf(NotificationNotOwnedError);
      expect(mockRepo.markAsRead).not.toHaveBeenCalled();
    });

    it("resolves and calls markAsRead when the row belongs to the caller", async () => {
      mockRepo.findById.mockResolvedValueOnce({ id: "n-1", userId: "user-1" });

      await service.markAsRead("user-1", "n-1");

      expect(mockRepo.markAsRead).toHaveBeenCalledWith("n-1");
    });
  });
});
