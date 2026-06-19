import { Injectable } from "@nestjs/common";

import { CreateFaqCategoryDto } from "./dto/create-faq-category.dto";
import { ListFaqCategoriesDto } from "./dto/list-faq-categories.dto";
import { UpdateFaqCategoryDto } from "./dto/update-faq-category.dto";
import { FaqCategoryNameAlreadyExistsError } from "./errors/faq-category-name-already-exists.error";
import { FaqCategoryNotFoundError } from "./errors/faq-category-not-found.error";
import { FaqCategoryRepository } from "./faq-category.repository";

@Injectable()
export class FaqCategoryService {
  constructor(private readonly faqCategoryRepository: FaqCategoryRepository) {}
  async createCategory(createFaqCategoryDto: CreateFaqCategoryDto) {
    const normalizedName = createFaqCategoryDto.name.trim();
    const normalizedDescription = createFaqCategoryDto.description?.trim() ?? null;
    const existingCategory = await this.faqCategoryRepository.findByName(normalizedName);
    if (existingCategory) {
      throw new FaqCategoryNameAlreadyExistsError();
    }

    return this.faqCategoryRepository.create({
      name: normalizedName,
      description: normalizedDescription,
    });
  }

  async getCategoryById(id: string) {
    const category = await this.faqCategoryRepository.findById(id);
    if (!category) {
      throw new FaqCategoryNotFoundError();
    }
    return category;
  }

  async getCategoryList(listFaqCategoriesDto: ListFaqCategoriesDto) {
    const page = listFaqCategoriesDto.page ?? 1;
    const size = listFaqCategoriesDto.size ?? 10;
    const skip = (page - 1) * size;

    const [items, total] = await Promise.all([
      this.faqCategoryRepository.findMany(skip, size),
      this.faqCategoryRepository.count(),
    ]);

    return {
      items,
      meta: {
        page,
        size,
        total,
        totalPages: Math.ceil(total / size),
      },
    };
  }

  async updateCategory(id: string, updateFaqCategoryDto: UpdateFaqCategoryDto) {
    const category = await this.faqCategoryRepository.findById(id);
    if (!category) {
      throw new FaqCategoryNotFoundError();
    }

    if (updateFaqCategoryDto.name && updateFaqCategoryDto.name.trim() !== category.name) {
      const existingCategory = await this.faqCategoryRepository.findByName(updateFaqCategoryDto.name.trim());
      if (existingCategory) {
        throw new FaqCategoryNameAlreadyExistsError();
      }
    }

    return this.faqCategoryRepository.update(id, {
      ...(updateFaqCategoryDto.name !== undefined && {
        name: updateFaqCategoryDto.name.trim(),
      }),
      ...(updateFaqCategoryDto.description !== undefined && {
        description: updateFaqCategoryDto.description?.trim() ?? null,
      }),
    });
  }

  async deleteCategory(id: string) {
    const category = await this.faqCategoryRepository.findById(id);
    if (!category) {
      throw new FaqCategoryNotFoundError();
    }

    await this.faqCategoryRepository.delete(id);
    return {
      deleted: true,
      id,
    };
  }
}
