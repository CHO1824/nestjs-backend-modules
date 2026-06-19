import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/common/prisma/prisma.service";

@Injectable()
export class FaqCategoryRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(data: { name: string; description: string | null }) {
    return this.prismaService.faqCategory.create({
      data,
    });
  }

  async findById(id: string) {
    return this.prismaService.faqCategory.findUnique({
      where: { id },
    });
  }

  async findByName(name: string) {
    return this.prismaService.faqCategory.findUnique({
      where: { name },
    });
  }

  async findMany(skip: number, take: number) {
    return this.prismaService.faqCategory.findMany({
      skip,
      take,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async count() {
    return this.prismaService.faqCategory.count();
  }

  async update(id: string, data: { name?: string; description?: string | null }) {
    return this.prismaService.faqCategory.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prismaService.faqCategory.delete({
      where: { id },
    });
  }
}
