import { Inject, Injectable } from "@nestjs/common";

import { AuditLogService } from "@/common/audit/audit-log.service";

import { FaqAuditAction } from "./constants/faq-audit-actions";
import { CreateFaqDto } from "./dto/create-faq.dto";
import { FaqListResponseDto } from "./dto/faq-list-response.dto";
import { FaqResponseDto } from "./dto/faq-response.dto";
import { ListFaqQueryDto } from "./dto/list-faq-query.dto";
import { UpdateFaqDto } from "./dto/update-faq.dto";
import { FaqNotFoundError } from "./errors/faq.error";
import { FAQ_REPOSITORY, FaqRepositoryInterface, UpdateFaqRepositoryParams } from "./faq.repository.interface";

/** Audit log object-context label & resource type for FAQ admin actions */
const FAQ_AUDIT_MODULE = "FAQ";
const FAQ_AUDIT_RESOURCE = "faq";

interface FaqEntity {
  id: string;
  question: string;
  answer: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/** FAQ fields tracked in the before/after audit snapshot */
type FaqAuditSnapshot = Pick<FaqEntity, "question" | "answer" | "isActive" | "sortOrder">;

@Injectable()
export class FaqService {
  constructor(
    @Inject(FAQ_REPOSITORY)
    private readonly faqRepository: FaqRepositoryInterface,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(createFaqDto: CreateFaqDto): Promise<FaqResponseDto> {
    const faq = await this.faqRepository.create({
      question: createFaqDto.question,
      answer: createFaqDto.answer,
      isActive: createFaqDto.isActive ?? true,
      sortOrder: createFaqDto.sortOrder ?? 0,
    });

    await this.auditLog.admin(FaqAuditAction.CREATED, {
      module: FAQ_AUDIT_MODULE,
      resource: FAQ_AUDIT_RESOURCE,
      resourceId: faq.id,
      newValue: JSON.stringify(this.toAuditSnapshot(faq)),
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
    const before = await this.getFaqOrThrow(id);

    // Collect only the fields that are present AND actually different, so an
    // unchanged request skips both the DB write and the audit log entry.
    const updateData: UpdateFaqRepositoryParams = {};
    if (updateFaqDto.question !== undefined && updateFaqDto.question !== before.question) {
      updateData.question = updateFaqDto.question;
    }
    if (updateFaqDto.answer !== undefined && updateFaqDto.answer !== before.answer) {
      updateData.answer = updateFaqDto.answer;
    }
    if (updateFaqDto.isActive !== undefined && updateFaqDto.isActive !== before.isActive) {
      updateData.isActive = updateFaqDto.isActive;
    }
    if (updateFaqDto.sortOrder !== undefined && updateFaqDto.sortOrder !== before.sortOrder) {
      updateData.sortOrder = updateFaqDto.sortOrder;
    }

    if (Object.keys(updateData).length === 0) {
      return this.toResponseDto(before);
    }

    const updatedFaq = await this.faqRepository.update(id, updateData);

    // Record the full before/after snapshot so the FE can render the field-level diff UI.
    await this.auditLog.admin(FaqAuditAction.UPDATED, {
      module: FAQ_AUDIT_MODULE,
      resource: FAQ_AUDIT_RESOURCE,
      resourceId: id,
      oldValue: JSON.stringify(this.toAuditSnapshot(before)),
      newValue: JSON.stringify(this.toAuditSnapshot(updatedFaq)),
    });

    return this.toResponseDto(updatedFaq);
  }

  async delete(id: string): Promise<void> {
    const before = await this.getFaqOrThrow(id);
    await this.faqRepository.delete(id);

    await this.auditLog.admin(FaqAuditAction.DELETED, {
      module: FAQ_AUDIT_MODULE,
      resource: FAQ_AUDIT_RESOURCE,
      resourceId: id,
      oldValue: JSON.stringify(this.toAuditSnapshot(before)),
    });
  }

  private async getFaqOrThrow(id: string): Promise<FaqEntity> {
    const faq = await this.faqRepository.findById(id);
    if (!faq) {
      throw new FaqNotFoundError();
    }
    return faq;
  }

  /** Snapshot of the audited fields only (used for create/delete records) */
  private toAuditSnapshot(faq: FaqEntity): FaqAuditSnapshot {
    return {
      question: faq.question,
      answer: faq.answer,
      isActive: faq.isActive,
      sortOrder: faq.sortOrder,
    };
  }

  private toResponseDto(faq: FaqEntity): FaqResponseDto {
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
