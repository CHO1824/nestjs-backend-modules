import { Test, TestingModule } from "@nestjs/testing";

import { FaqController } from "./faq.controller";
import { FaqService } from "./faq.service";

describe("FaqController", () => {
  let controller: FaqController;
  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FaqController],
      providers: [
        {
          provide: FaqService,
          useValue: mockService,
        },
      ],
    }).compile();
    controller = module.get<FaqController>(FaqController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
