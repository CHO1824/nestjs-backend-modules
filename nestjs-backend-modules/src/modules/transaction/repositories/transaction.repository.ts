import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/common/prisma/prisma.service";

import { Prisma } from "../../../../generated/prisma/client";
import { TransactionStatus } from "../../../../generated/prisma/enums";

export interface FindManyTransactionsParams {
  userId: string;
  limit: number;
  status?: TransactionStatus;
  cursor?: {
    createdAt: Date;
    id: string;
  };
}

@Injectable()
export class TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Optional tx client lets callers read inside their own Prisma transaction so
  // a status update can see writes made earlier in the same transaction.
  findById(transactionId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.transaction.findUnique({
      where: { id: transactionId },
    });
  }

  // Combines the existence check and the ownership filter so the API cannot
  // distinguish "missing" from "not yours" via response codes or timing.
  findByIdForUser(transactionId: string, userId: string) {
    return this.prisma.transaction.findFirst({
      where: { id: transactionId, userId },
    });
  }

  async updateStatus(
    transactionId: string,
    currentStatus: TransactionStatus,
    nextStatus: TransactionStatus,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const updated = await client.transaction.updateMany({
      where: { id: transactionId, status: currentStatus },
      data: { status: nextStatus },
    });
    return updated.count > 0;
  }

  // Returns up to limit+1 rows so the caller can detect a next page without
  // an extra count query. Tie-breaker on id keeps pagination stable when
  // multiple rows share the same createdAt timestamp.
  findManyByUserId(params: FindManyTransactionsParams) {
    const where: Prisma.TransactionWhereInput = {
      userId: params.userId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.cursor
        ? {
            OR: [
              { createdAt: { lt: params.cursor.createdAt } },
              {
                AND: [{ createdAt: params.cursor.createdAt }, { id: { lt: params.cursor.id } }],
              },
            ],
          }
        : {}),
    };

    return this.prisma.transaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: params.limit + 1,
    });
  }
}
