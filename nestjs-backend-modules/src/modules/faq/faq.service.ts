import { Inject, Injectable } from "@nestjs/common";

import { CreateFaqDto } from "./dto/create-faq.dto";
import { FaqListResponseDto } from "./dto/faq-list-response.dto";
import { FaqResponseDto } from "./dto/faq-response.dto";
import { ListFaqQueryDto } from "./dto/list-faq-query.dto";
import { UpdateFaqDto } from "./dto/update-faq.dto";
import { FaqNotFoundError } from "./errors/faq.error";
import { FAQ_REPOSITORY, FaqRepositoryInterface } from "./faq.repository.interface";

@Injectable()
export class FaqService {
  constructor(
    @Inject(FAQ_REPOSITORY)
    private readonly faqRepository: FaqRepositoryInterface,
  ) {}

  async create(createFaqDto: CreateFaqDto): Promise<FaqResponseDto> {
    const faq = await this.faqRepository.create({
      question: createFaqDto.question,
      answer: createFaqDto.answer,
      isActive: createFaqDto.isActive ?? true,
      sortOrder: createFaqDto.sortOrder ?? 0,
    });
    return this.toResponseDto(faq);
  }

  async findOne(id: string): Promise<FaqResponseDto> {
    const faq = await this.faqRepository.findById(id);
    if (!faq) {
      throw new FaqNotFoundError();
    }
    return this.toResponseDto(faq);
  }

  async findAll(query: ListFaqQueryDto): Promise<FaqListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [items, totalCount] = await Promise.all([
      this.faqRepository.findMany({
        keyword: query.keyword,
        isActive: query.isActive,
        skip,
        take: limit,
        sortBy: query.sortBy ?? "sortOrder",
        order: query.order ?? "asc",
      }),
      this.faqRepository.count({
        keyword: query.keyword,
        isActive: query.isActive,
      }),
    ]);

    return {
      items: items.map((item) => this.toResponseDto(item)),
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  async update(id: string, updateFaqDto: UpdateFaqDto): Promise<FaqResponseDto> {
    await this.validateFaqExists(id);
    const updatedFaq = await this.faqRepository.update(id, {
      ...(updateFaqDto.question !== undefined && { question: updateFaqDto.question }),
      ...(updateFaqDto.answer !== undefined && { answer: updateFaqDto.answer }),
      ...(updateFaqDto.isActive !== undefined && { isActive: updateFaqDto.isActive }),
      ...(updateFaqDto.sortOrder !== undefined && { sortOrder: updateFaqDto.sortOrder }),
    });
    return this.toResponseDto(updatedFaq);
  }

  async delete(id: string): Promise<void> {
    await this.validateFaqExists(id);
    await this.faqRepository.delete(id);
  }

  private async validateFaqExists(id: string): Promise<void> {
    const faq = await this.faqRepository.findById(id);
    if (!faq) {
      throw new FaqNotFoundError();
    }
  }

  private toResponseDto(faq: {
    id: string;
    question: string;
    answer: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): FaqResponseDto {
    return {
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      isActive: faq.isActive,
      sortOrder: faq.sortOrder,
      createdAt: faq.createdAt,
      updatedAt: faq.updatedAt,
    };
  }
}
