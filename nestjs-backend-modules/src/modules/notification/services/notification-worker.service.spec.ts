import { Test, TestingModule } from "@nestjs/testing";

import { NotificationOutbox } from "../../../../generated/prisma/client";
import { NotificationDeliveryError, PushDeliveryError } from "../errors/notification.errors";
import { NotificationSender } from "../interfaces/notification-sender.interface";
import { NotificationRepository } from "../notification.repository";
import { NotificationPolicyService } from "./notification-policy.service";
import { NotificationSenderService } from "./notification-sender.service";
import { NotificationTemplateService } from "./notification-template.service";
import { NotificationWorkerService } from "./notification-worker.service";

/**
 * Verifies the push → Alimtalk fallback: when a PUSH outbox job fails and
 * exhausts its retries, the worker enqueues a KAKAO job to the user's phone —
 * with the recipient normalized (leading 0 stripped, country code prepended)
 * and only when the consent policy allows the channel.
 */
describe("NotificationWorkerService — push → Alimtalk fallback", () => {
  let worker: NotificationWorkerService;
  let repo: Record<string, jest.Mock>;
  let pushSender: { channel: string; send: jest.Mock };
  let policy: { isAllowed: jest.Mock };

  const makeJob = (overrides: Partial<NotificationOutbox> = {}): NotificationOutbox =>
    ({
      id: "job-1",
      userId: "user-1",
      traceId: "trace-1",
      category: "TRANSACTIONAL",
      targetValue: "fcm-token",
      locale: "en",
      channel: "PUSH",
      templateId: "remittance.completed",
      payload: { amount: 1000 },
      status: "PROCESSING",
      priority: 0,
      retryCount: 0,
      nextRetryAt: new Date(),
      lockedAt: new Date(),
      errorLog: null,
      createdAt: new Date(),
      ...overrides,
    }) as NotificationOutbox;

  beforeEach(async () => {
    repo = {
      claimPendingBatch: jest.fn().mockResolvedValue([]),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      incrementRetry: jest.fn().mockResolvedValue(undefined),
      // Local-format number with a leading 0 — must be normalized to +8210...
      findUserContext: jest
        .fn()
        .mockResolvedValue({ id: "user-1", phoneNumber: "01012345678", phoneCountryCode: "+82", preferences: [] }),
      createOutbox: jest.fn().mockResolvedValue({ id: "kakao-job" }),
      reapStuckNotifications: jest.fn().mockResolvedValue(undefined),
      pruneExpiredIdempotency: jest.fn().mockResolvedValue({ count: 0 }),
    };

    pushSender = { channel: "PUSH", send: jest.fn().mockResolvedValue(undefined) };
    policy = { isAllowed: jest.fn().mockReturnValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationWorkerService,
        { provide: NotificationRepository, useValue: repo },
        {
          provide: NotificationTemplateService,
          useValue: { render: jest.fn().mockReturnValue({ title: "t", message: "m" }) },
        },
        { provide: NotificationSenderService, useValue: { sendWithFallback: jest.fn() } },
        { provide: NotificationPolicyService, useValue: policy },
        { provide: "NOTIFICATION_SENDERS", useValue: [pushSender] as NotificationSender[] },
      ],
    }).compile();

    worker = module.get(NotificationWorkerService);
  });

  it("enqueues a normalized KAKAO Alimtalk fallback when a PUSH job exhausts retries", async () => {
    pushSender.send.mockRejectedValue(new NotificationDeliveryError("PUSH"));
    repo.claimPendingBatch.mockResolvedValue([makeJob({ retryCount: 1 })]);

    await worker.handleQueue();

    expect(repo.updateStatus).toHaveBeenCalledWith("job-1", "FAILED", expect.any(String));
    // "01012345678" → strip leading 0 → "+82" + "1012345678"; status explicit.
    expect(repo.createOutbox).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "KAKAO", targetValue: "+821012345678", status: "PENDING" }),
    );
  });

  it("skips the fallback (no enqueue) when the user has no phone number", async () => {
    pushSender.send.mockRejectedValue(new NotificationDeliveryError("PUSH"));
    repo.findUserContext.mockResolvedValue({ id: "user-1", phoneNumber: null, preferences: [] });
    repo.claimPendingBatch.mockResolvedValue([makeJob({ retryCount: 1 })]);

    await worker.handleQueue();

    expect(repo.updateStatus).toHaveBeenCalledWith("job-1", "FAILED", expect.any(String));
    expect(repo.createOutbox).not.toHaveBeenCalled();
  });

  it("skips the fallback when policy disallows the channel (e.g. marketing without consent)", async () => {
    pushSender.send.mockRejectedValue(new NotificationDeliveryError("PUSH"));
    policy.isAllowed.mockReturnValue(false);
    repo.claimPendingBatch.mockResolvedValue([makeJob({ retryCount: 1, category: "MARKETING" })]);

    await worker.handleQueue();

    expect(repo.updateStatus).toHaveBeenCalledWith("job-1", "FAILED", expect.any(String));
    expect(repo.createOutbox).not.toHaveBeenCalled();
  });

  it("retries instead of falling back while a PUSH job still has retries left", async () => {
    pushSender.send.mockRejectedValue(new NotificationDeliveryError("PUSH"));
    repo.claimPendingBatch.mockResolvedValue([makeJob({ retryCount: 0 })]);

    await worker.handleQueue();

    expect(repo.incrementRetry).toHaveBeenCalled();
    expect(repo.createOutbox).not.toHaveBeenCalled();
  });

  it("skips retry and falls back immediately on a permanent PUSH failure (invalid token), even with retries left", async () => {
    // retryCount=0 would normally retry; permanent failure short-circuits that.
    pushSender.send.mockRejectedValue(new PushDeliveryError(true, "messaging/registration-token-not-registered"));
    repo.claimPendingBatch.mockResolvedValue([makeJob({ retryCount: 0 })]);

    await worker.handleQueue();

    expect(repo.incrementRetry).not.toHaveBeenCalled();
    expect(repo.updateStatus).toHaveBeenCalledWith("job-1", "FAILED", expect.any(String));
    expect(repo.createOutbox).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "KAKAO", status: "PENDING" }),
    );
  });

  it("retries (does not fall back) on a transient PUSH failure with retries left", async () => {
    pushSender.send.mockRejectedValue(new PushDeliveryError(false, "messaging/internal-error"));
    repo.claimPendingBatch.mockResolvedValue([makeJob({ retryCount: 0 })]);

    await worker.handleQueue();

    expect(repo.incrementRetry).toHaveBeenCalled();
    expect(repo.createOutbox).not.toHaveBeenCalled();
  });

  it("does not fall back when the PUSH succeeds", async () => {
    pushSender.send.mockResolvedValue(undefined);
    repo.claimPendingBatch.mockResolvedValue([makeJob({ retryCount: 1 })]);

    await worker.handleQueue();

    expect(repo.updateStatus).toHaveBeenCalledWith("job-1", "SENT");
    expect(repo.createOutbox).not.toHaveBeenCalled();
  });

  describe("pruneIdempotencyKeys (expired key cleanup)", () => {
    const logSpy = (w: NotificationWorkerService) =>
      jest.spyOn((w as unknown as { logger: { log: (msg: string) => void } }).logger, "log");

    it("prunes expired keys and logs the count when any were removed", async () => {
      repo.pruneExpiredIdempotency.mockResolvedValue({ count: 3 });
      const log = logSpy(worker);

      await worker.pruneIdempotencyKeys();

      expect(repo.pruneExpiredIdempotency).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("3"));
    });

    it("prunes but stays silent when nothing was expired", async () => {
      repo.pruneExpiredIdempotency.mockResolvedValue({ count: 0 });
      const log = logSpy(worker);

      await worker.pruneIdempotencyKeys();

      expect(repo.pruneExpiredIdempotency).toHaveBeenCalledTimes(1);
      expect(log).not.toHaveBeenCalled();
    });
  });
});
