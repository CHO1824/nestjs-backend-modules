import { Test, TestingModule } from "@nestjs/testing";

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqService,
        {
          provide: FAQ_REPOSITORY,
          useValue: mockRepository,
        },
      ],
    }).compile();
    service = module.get<FaqService>(FaqService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
