import { Test, TestingModule } from "@nestjs/testing";

import { AuditLogService } from "@/common/audit/audit-log.service";

import { FaqNotFoundError } from "./errors/faq.error";
import { FAQ_REPOSITORY } from "./faq.repository.interface";
import { FaqService } from "./faq.service";

describe("FaqService", () => {
  let service: FaqService;

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockAuditLog = {
    admin: jest.fn(),
  };

  const baseFaq = {
    id: "11111111-1111-1111-1111-111111111111",
    question: "Q1",
    answer: "A1",
    isActive: true,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqService,
        {
          provide: FAQ_REPOSITORY,
          useValue: mockRepository,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLog,
        },
      ],
    }).compile();
    service = module.get<FaqService>(FaqService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("records a create audit log with the new value snapshot", async () => {
      mockRepository.create.mockResolvedValue(baseFaq);

      await service.create({ question: "Q1", answer: "A1" });

      expect(mockAuditLog.admin).toHaveBeenCalledWith(
        "faq.entry.created",
        expect.objectContaining({
          module: "FAQ",
          resource: "faq",
          resourceId: baseFaq.id,
          newValue: JSON.stringify({ question: "Q1", answer: "A1", isActive: true, sortOrder: 0 }),
        }),
      );
    });
  });

  describe("update", () => {
    it("records the full before/after snapshot when a field changes", async () => {
      mockRepository.findById.mockResolvedValue(baseFaq);
      mockRepository.update.mockResolvedValue({ ...baseFaq, answer: "A2", updatedAt: new Date() });

      await service.update(baseFaq.id, { answer: "A2" });

      expect(mockAuditLog.admin).toHaveBeenCalledWith(
        "faq.entry.updated",
        expect.objectContaining({
          resourceId: baseFaq.id,
          oldValue: JSON.stringify({ question: "Q1", answer: "A1", isActive: true, sortOrder: 0 }),
          newValue: JSON.stringify({ question: "Q1", answer: "A2", isActive: true, sortOrder: 0 }),
        }),
      );
    });

    it("does not record an audit log and does not update the database when nothing actually changed", async () => {
      mockRepository.findById.mockResolvedValue(baseFaq);

      await service.update(baseFaq.id, { answer: "A1" });

      expect(mockRepository.update).not.toHaveBeenCalled();
      expect(mockAuditLog.admin).not.toHaveBeenCalled();
    });

    it("throws when the FAQ does not exist", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.update(baseFaq.id, { answer: "A2" })).rejects.toThrow(FaqNotFoundError);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("records a delete audit log with the old value snapshot", async () => {
      mockRepository.findById.mockResolvedValue(baseFaq);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.delete(baseFaq.id);

      expect(mockAuditLog.admin).toHaveBeenCalledWith(
        "faq.entry.deleted",
        expect.objectContaining({
          resourceId: baseFaq.id,
          oldValue: JSON.stringify({ question: "Q1", answer: "A1", isActive: true, sortOrder: 0 }),
        }),
      );
    });
  });
});
