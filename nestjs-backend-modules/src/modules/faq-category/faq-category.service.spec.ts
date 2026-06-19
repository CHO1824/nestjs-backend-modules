import { Test, TestingModule } from "@nestjs/testing";

import { FaqCategoryNameAlreadyExistsError } from "./errors/faq-category-name-already-exists.error";
import { FaqCategoryNotFoundError } from "./errors/faq-category-not-found.error";
import { FaqCategoryRepository } from "./faq-category.repository";
import { FaqCategoryService } from "./faq-category.service";

describe("FaqCategoryService", () => {
  let service: FaqCategoryService;
  let repository: jest.Mocked<FaqCategoryRepository>;

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqCategoryService,
        {
          provide: FaqCategoryRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get(FaqCategoryService);
    repository = module.get(FaqCategoryRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createCategory", () => {
    it("should create category successfully", async () => {
      repository.findByName.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        id: "1",
        name: "Account",
        description: null,
      } as any);

      const result = await service.createCategory({
        name: "Account",
      });

      expect(result.name).toBe("Account");
    });

    it("should throw error if name already exists", async () => {
      repository.findByName.mockResolvedValue({ id: "1" } as any);
      await expect(service.createCategory({ name: "Account" })).rejects.toThrow(FaqCategoryNameAlreadyExistsError);
    });
  });

  describe("getCategoryById", () => {
    it("should return category", async () => {
      repository.findById.mockResolvedValue({
        id: "1",
        name: "Account",
      } as any);
      const result = await service.getCategoryById("1");
      expect(result.id).toBe("1");
    });

    it("should throw error if not found", async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.getCategoryById("1")).rejects.toThrow(FaqCategoryNotFoundError);
    });
  });

  describe("getCategoryList", () => {
    it("should return paginated list", async () => {
      repository.findMany.mockResolvedValue([{ id: "1" }] as any);
      repository.count.mockResolvedValue(1);

      const result = await service.getCategoryList({
        page: 1,
        size: 10,
      });

      expect(result.items.length).toBe(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe("updateCategory", () => {
    it("should update category", async () => {
      repository.findById.mockResolvedValue({ id: "1", name: "Old" } as any);
      repository.findByName.mockResolvedValue(null);
      repository.update.mockResolvedValue({ id: "1", name: "New" } as any);
      const result = await service.updateCategory("1", { name: "New" });
      expect(result.name).toBe("New");
    });
  });

  describe("deleteCategory", () => {
    it("should delete category", async () => {
      repository.findById.mockResolvedValue({ id: "1" } as any);
      repository.delete.mockResolvedValue({ id: "1" } as any);
      const result = await service.deleteCategory("1");
      expect(result.deleted).toBe(true);
    });
  });
});
