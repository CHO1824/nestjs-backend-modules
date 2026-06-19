import { TransactionStatus } from "../../../../generated/prisma/enums";
import { TransactionRepository } from "../repositories/transaction.repository";

describe("TransactionRepository", () => {
  let prisma: {
    transaction: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let repository: TransactionRepository;

  beforeEach(() => {
    prisma = {
      transaction: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    repository = new TransactionRepository(prisma as never);
  });

  describe("findByIdForUser", () => {
    it("looks up by id and owner user id together", async () => {
      const transaction = { id: "tx-1", userId: "user-1" };
      prisma.transaction.findFirst.mockResolvedValue(transaction);

      const result = await repository.findByIdForUser("tx-1", "user-1");

      expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: "tx-1", userId: "user-1" },
      });
      expect(result).toBe(transaction);
    });
  });

  describe("updateStatus", () => {
    it("returns true when the guarded update writes a row", async () => {
      prisma.transaction.updateMany.mockResolvedValue({ count: 1 });

      const result = await repository.updateStatus("tx-1", TransactionStatus.PENDING, TransactionStatus.COMPLETED);

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: "tx-1", status: TransactionStatus.PENDING },
        data: { status: TransactionStatus.COMPLETED },
      });
      expect(result).toBe(true);
    });

    it("returns false when the status guard misses", async () => {
      prisma.transaction.updateMany.mockResolvedValue({ count: 0 });

      const result = await repository.updateStatus("tx-1", TransactionStatus.PENDING, TransactionStatus.COMPLETED);

      expect(result).toBe(false);
    });

    it("uses the provided Prisma transaction client", async () => {
      const tx = {
        transaction: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      await repository.updateStatus("tx-1", TransactionStatus.PENDING, TransactionStatus.FAILED, tx as never);

      expect(tx.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: "tx-1", status: TransactionStatus.PENDING },
        data: { status: TransactionStatus.FAILED },
      });
      expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
    });
  });
});
