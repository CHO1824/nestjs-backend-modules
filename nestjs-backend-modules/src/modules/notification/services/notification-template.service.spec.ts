import { NotificationEventType } from "../constants/notification.constants";
import { NotificationRepository } from "../notification.repository";
import { TEMPLATE_TEXT } from "./notification-template.defaults";
import { NotificationTemplateService } from "./notification-template.service";

type RepoMock = {
  findAllMessageTemplates: jest.Mock;
  seedMessageTemplates: jest.Mock;
};

describe("NotificationTemplateService", () => {
  let service: NotificationTemplateService;
  let repo: RepoMock;

  beforeEach(() => {
    repo = {
      findAllMessageTemplates: jest.fn().mockResolvedValue([]),
      seedMessageTemplates: jest.fn().mockResolvedValue(0),
    };
    service = new NotificationTemplateService(repo as unknown as NotificationRepository);
  });

  describe("render (code defaults)", () => {
    it("interpolates payload values into the default copy", async () => {
      const content = await service.render(
        NotificationEventType.REMITTANCE_COMPLETED,
        { amount: 100000, currency: "KRW", recipientName: "Nguyen" },
        "en",
      );
      expect(content.title).toBe("Transfer Completed");
      expect(content.message).toBe("Transfer of 100000 to Nguyen has been successfully completed.");
      expect(content.sysCode).toBe("#REM-004");
      expect(content.priority).toBe("HIGH");
    });

    it("falls back to the inline default when a value is missing", async () => {
      const content = await service.render(
        NotificationEventType.KYC_PENDING,
        { userName: "" } as { userName: string },
        "en",
      );
      expect(content.message).toBe("Hello User, additional photos of your ID are required for verification.");
    });

    it("renders Korean copy for the ko locale", async () => {
      const content = await service.render(
        NotificationEventType.KYC_APPROVED,
        { userName: "홍길동", approvedAt: new Date() },
        "ko",
      );
      expect(content.message).toBe("축하합니다 홍길동님! 본인 인증이 완료되었습니다.");
    });

    it("prefers a payload-supplied sysCode over the default", async () => {
      const content = await service.render(
        NotificationEventType.SYSTEM_DOWNTIME,
        { node: "edge-1", lossRate: "50%", sysCode: "#SYS-999" },
        "en",
      );
      expect(content.sysCode).toBe("#SYS-999");
      expect(content.message).toBe("Node edge-1 is reporting 50% packet loss.");
    });
  });

  describe("render (DB overrides)", () => {
    it("overrides copy with a stored DB row for non-KAKAO channels", async () => {
      repo.findAllMessageTemplates.mockResolvedValue([
        {
          eventType: NotificationEventType.REMITTANCE_COMPLETED,
          locale: "en",
          title: "Done!",
          message: "Your {{amount}} to {{recipientName}} is done.",
        },
      ]);

      const content = await service.render(
        NotificationEventType.REMITTANCE_COMPLETED,
        { amount: 500, currency: "KRW", recipientName: "Kim" },
        "en",
        "EMAIL",
      );
      expect(content.title).toBe("Done!");
      expect(content.message).toBe("Your 500 to Kim is done.");
    });

    it("ignores DB overrides for KAKAO (must match NCP console template)", async () => {
      repo.findAllMessageTemplates.mockResolvedValue([
        {
          eventType: NotificationEventType.REMITTANCE_COMPLETED,
          locale: "en",
          title: "Overridden",
          message: "Overridden body",
        },
      ]);

      const content = await service.render(
        NotificationEventType.REMITTANCE_COMPLETED,
        { amount: 500, currency: "KRW", recipientName: "Kim" },
        "en",
        "KAKAO",
      );
      expect(content.title).toBe("Transfer Completed");
      expect(content.message).toBe("Transfer of 500 to Kim has been successfully completed.");
      // KAKAO must never read the override table.
      expect(repo.findAllMessageTemplates).not.toHaveBeenCalled();
    });

    it("caches the override table and re-reads after invalidation", async () => {
      await service.render(NotificationEventType.KYC_APPROVED, { userName: "A", approvedAt: new Date() }, "en", "PUSH");
      await service.render(NotificationEventType.KYC_APPROVED, { userName: "B", approvedAt: new Date() }, "en", "PUSH");
      expect(repo.findAllMessageTemplates).toHaveBeenCalledTimes(1);

      service.invalidateCache();
      await service.render(NotificationEventType.KYC_APPROVED, { userName: "C", approvedAt: new Date() }, "en", "PUSH");
      expect(repo.findAllMessageTemplates).toHaveBeenCalledTimes(2);
    });

    it("renders code defaults when the override lookup fails", async () => {
      repo.findAllMessageTemplates.mockRejectedValue(new Error("db down"));
      const content = await service.render(
        NotificationEventType.KYC_APPROVED,
        { userName: "A", approvedAt: new Date() },
        "en",
        "EMAIL",
      );
      expect(content.message).toBe("Congratulations A! Your identity verification is complete.");
    });
  });

  describe("exists", () => {
    it("recognizes known event types", () => {
      expect(service.exists(NotificationEventType.KYC_APPROVED)).toBe(true);
      expect(service.exists("not.a.real.event")).toBe(false);
    });
  });

  describe("onModuleInit", () => {
    it("seeds all event/locale rows and tolerates seeding failure", async () => {
      await service.onModuleInit();
      expect(repo.seedMessageTemplates).toHaveBeenCalledTimes(1);
      const rows = repo.seedMessageTemplates.mock.calls[0][0];
      // all known events x 2 locales
      expect(rows).toHaveLength(Object.keys(TEMPLATE_TEXT).length * 2);

      repo.seedMessageTemplates.mockRejectedValueOnce(new Error("no table"));
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });
});
