import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/common/prisma/prisma.service";

import {
  CountFaqParams,
  CreateFaqRepositoryParams,
  FaqEntity,
  FaqRepositoryInterface,
  FindFaqListParams,
  UpdateFaqRepositoryParams,
} from "./faq.repository.interface";

@Injectable()
export class FaqRepository implements FaqRepositoryInterface {
  constructor(private readonly prismaService: PrismaService) {}
  async create(data: CreateFaqRepositoryParams): Promise<FaqEntity> {
    return this.prismaService.faq.create({
      data: {
        question: data.question,
        answer: data.answer,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
  }

  async findById(id: string): Promise<FaqEntity | null> {
    return this.prismaService.faq.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateFaqRepositoryParams): Promise<FaqEntity> {
    return this.prismaService.faq.update({
      where: { id },
      data: {
        ...(data.question !== undefined && { question: data.question }),
        ...(data.answer !== undefined && { answer: data.answer }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prismaService.faq.delete({ where: { id } });
  }

  async findMany(params: FindFaqListParams): Promise<FaqEntity[]> {
    const where = this.buildWhere({ keyword: params.keyword, isActive: params.isActive });
    return this.prismaService.faq.findMany({
      where,
      skip: params.skip,
      take: params.take,
      orderBy: { [params.sortBy]: params.order },
    });
  }

  async count(params: CountFaqParams): Promise<number> {
    const where = this.buildWhere(params);
    return this.prismaService.faq.count({ where });
  }

  private buildWhere(params: CountFaqParams) {
    const where: {
      isActive?: boolean;
      OR?: Array<{
        question?: { contains: string; mode: "insensitive" };
        answer?: { contains: string; mode: "insensitive" };
      }>;
    } = {};

    if (typeof params.isActive === "boolean") {
      where.isActive = params.isActive;
    }
    if (params.keyword?.trim()) {
      const keyword = params.keyword.trim();
      where.OR = [
        {
          question: { contains: keyword, mode: "insensitive" },
        },
        {
          answer: { contains: keyword, mode: "insensitive" },
        },
      ];
    }
    return where;
  }
}
