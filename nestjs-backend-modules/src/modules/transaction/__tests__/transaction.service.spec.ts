import { TransactionStatus } from "../../../../generated/prisma/enums";
import { decodeTransactionListCursor, encodeTransactionListCursor } from "../domain/transaction-list-cursor";
import { TransactionListQueryDto } from "../dto/transaction-list-query.dto";
import {
  InvalidTransactionListCursorError,
  InvalidTransactionStatusTransitionError,
  TransactionNotFoundError,
  TransactionStatusAlreadyFinalizedError,
} from "../errors/transaction.error";
import { TransactionService } from "../services/transaction.service";

const toDecimal = (value: number | string) => ({
  toString: () => String(value),
  toNumber: () => Number(value),
});

const buildTransaction = (overrides: Record<string, unknown> = {}) => ({
  id: "11111111-1111-1111-1111-111111111111",
  trackingNumber: "VP-track-1",
  userId: "user-1",
  beneficiaryId: "ben-1",
  quoteId: "quote-1",
  status: TransactionStatus.CREATED,
  senderCurrency: "KRW",
  senderCountry: "KR",
  beneficiaryCurrency: "VND",
  beneficiaryCountry: "Vietnam",
  sendAmount: toDecimal(100000),
  receiveAmount: toDecimal(3200000),
  fxRate: toDecimal(32),
  remittanceFee: toDecimal(1),
  createdAt: new Date("2026-05-01T10:00:00.000Z"),
  updatedAt: new Date("2026-05-01T10:00:00.000Z"),
  ...overrides,
});

describe("TransactionService", () => {
  let repository: {
    findById: jest.Mock;
    findByIdForUser: jest.Mock;
    findManyByUserId: jest.Mock;
    updateStatus: jest.Mock;
  };
  let prisma: {
    transaction: { findUnique: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let transferState: { transition: jest.Mock };
  let service: TransactionService;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByIdForUser: jest.fn(),
      findManyByUserId: jest.fn(),
      updateStatus: jest.fn(),
    };
    prisma = {
      transaction: { findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    transferState = { transition: jest.fn().mockResolvedValue(undefined) };
    service = new TransactionService(repository as never, prisma as never, transferState as never);
  });

  describe("findMany", () => {
    const userId = "user-1";

    const buildQuery = (overrides: Partial<TransactionListQueryDto> = {}): TransactionListQueryDto => ({
      limit: 20,
      ...overrides,
    });

    it("returns no nextCursor when result count <= limit", async () => {
      repository.findManyByUserId.mockResolvedValue([buildTransaction()]);
      const result = await service.findMany(userId, buildQuery({ limit: 20 }));
      expect(result.hasNext).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.items).toHaveLength(1);
      expect(result.limit).toBe(20);
    });

    it("trims to limit and emits a cursor when an extra row is returned", async () => {
      const rows = [
        buildTransaction({
          id: "11111111-1111-4111-8111-111111111111",
          createdAt: new Date("2026-05-01T10:00:00.000Z"),
        }),
        buildTransaction({
          id: "22222222-2222-4222-8222-222222222222",
          createdAt: new Date("2026-05-01T09:00:00.000Z"),
        }),
        buildTransaction({
          id: "33333333-3333-4333-8333-333333333333",
          createdAt: new Date("2026-05-01T08:00:00.000Z"),
        }),
      ];
      repository.findManyByUserId.mockResolvedValue(rows);

      const result = await service.findMany(userId, buildQuery({ limit: 2 }));
      expect(result.hasNext).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).not.toBeNull();
      expect(decodeTransactionListCursor(result.nextCursor!)).toEqual({
        createdAt: "2026-05-01T09:00:00.000Z",
        id: "22222222-2222-4222-8222-222222222222",
      });
    });

    it("forwards a decoded cursor to the repository", async () => {
      repository.findManyByUserId.mockResolvedValue([]);
      const cursor = encodeTransactionListCursor({
        createdAt: "2026-04-01T00:00:00.000Z",
        id: "44444444-4444-4444-8444-444444444444",
      });
      await service.findMany(userId, buildQuery({ cursor, limit: 10 }));
      expect(repository.findManyByUserId).toHaveBeenCalledWith({
        userId,
        limit: 10,
        status: undefined,
        cursor: {
          createdAt: new Date("2026-04-01T00:00:00.000Z"),
          id: "44444444-4444-4444-8444-444444444444",
        },
      });
    });

    it("forwards the status filter when provided", async () => {
      repository.findManyByUserId.mockResolvedValue([]);
      await service.findMany(userId, buildQuery({ status: TransactionStatus.COMPLETED }));
      expect(repository.findManyByUserId).toHaveBeenCalledWith(
        expect.objectContaining({ status: TransactionStatus.COMPLETED }),
      );
    });

    it("rejects malformed cursors", async () => {
      await expect(service.findMany(userId, buildQuery({ cursor: "not-a-cursor" }))).rejects.toBeInstanceOf(
        InvalidTransactionListCursorError,
      );
      expect(repository.findManyByUserId).not.toHaveBeenCalled();
    });
  });

  describe("findDetail", () => {
    const userId = "user-1";

    it("returns the transaction when the caller owns it", async () => {
      const transaction = buildTransaction({ userId });
      repository.findByIdForUser.mockResolvedValue(transaction);
      const result = await service.findDetail(transaction.id, userId);
      expect(repository.findByIdForUser).toHaveBeenCalledWith(transaction.id, userId);
      expect(result.id).toBe(transaction.id);
      expect(result.userId).toBe(userId);
      expect(result.sendAmount).toBe("100000.00");
      expect(result.receiveAmount).toBe("3200000.00");
      expect(result.fxRate).toBe("32.000000");
    });

    it("throws TransactionNotFoundError when missing", async () => {
      repository.findByIdForUser.mockResolvedValue(null);
      await expect(service.findDetail("missing-id", userId)).rejects.toBeInstanceOf(TransactionNotFoundError);
    });

    it("throws TransactionNotFoundError for non-owners to avoid existence leaks", async () => {
      repository.findByIdForUser.mockResolvedValue(null);
      await expect(service.findDetail("tx-id", userId)).rejects.toBeInstanceOf(TransactionNotFoundError);
    });
  });

  describe("updateStatus", () => {
    const transactionId = "tx-1";

    it.each([
      [TransactionStatus.CREATED, TransactionStatus.QUOTE_CONFIRMED],
      [TransactionStatus.QUOTE_CONFIRMED, TransactionStatus.PAYMENT_RECEIVED],
      [TransactionStatus.PAYMENT_RECEIVED, TransactionStatus.PROCESSING],
      [TransactionStatus.SENT_TO_PARTNER, TransactionStatus.COMPLETED],
      [TransactionStatus.FAILED, TransactionStatus.PROCESSING],
      [TransactionStatus.COMPLETED, TransactionStatus.REFUNDED],
    ])("updates from %s to %s through the repository", async (current, next) => {
      const before = buildTransaction({ status: current });
      const after = buildTransaction({ status: next });
      repository.findById.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
      repository.updateStatus.mockResolvedValue(true);

      const result = await service.updateStatus(transactionId, next);
      expect(repository.updateStatus).toHaveBeenCalledWith(transactionId, current, next, undefined);
      expect(result).toBe(after);
    });

    it("throws TransactionNotFoundError when the row is missing", async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.updateStatus(transactionId, TransactionStatus.COMPLETED)).rejects.toBeInstanceOf(
        TransactionNotFoundError,
      );
      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it("throws TransactionStatusAlreadyFinalizedError when current is terminal", async () => {
      repository.findById.mockResolvedValue(buildTransaction({ status: TransactionStatus.CANCELLED }));
      await expect(service.updateStatus(transactionId, TransactionStatus.PROCESSING)).rejects.toBeInstanceOf(
        TransactionStatusAlreadyFinalizedError,
      );
      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it("is a no-op when next status equals current (idempotent retry)", async () => {
      const tx = buildTransaction({ status: TransactionStatus.PROCESSING });
      repository.findById.mockResolvedValue(tx);

      const result = await service.updateStatus(transactionId, TransactionStatus.PROCESSING);
      expect(result).toBe(tx);
      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it("forwards the Prisma tx client to the repository when provided", async () => {
      const before = buildTransaction({ status: TransactionStatus.SENT_TO_PARTNER });
      const after = buildTransaction({ status: TransactionStatus.COMPLETED });
      repository.findById.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
      repository.updateStatus.mockResolvedValue(true);
      const fakeTx = { tag: "tx-client" } as never;

      await service.updateStatus(transactionId, TransactionStatus.COMPLETED, fakeTx);
      expect(repository.findById).toHaveBeenNthCalledWith(1, transactionId, fakeTx);
      expect(repository.findById).toHaveBeenNthCalledWith(2, transactionId, fakeTx);
      expect(repository.updateStatus).toHaveBeenCalledWith(
        transactionId,
        TransactionStatus.SENT_TO_PARTNER,
        TransactionStatus.COMPLETED,
        fakeTx,
      );
    });

    it("returns latest row when a concurrent writer already moved to the requested status", async () => {
      const sent = buildTransaction({ status: TransactionStatus.SENT_TO_PARTNER });
      const completed = buildTransaction({ status: TransactionStatus.COMPLETED });
      repository.findById.mockResolvedValueOnce(sent).mockResolvedValueOnce(completed);
      repository.updateStatus.mockResolvedValue(false);

      const result = await service.updateStatus(transactionId, TransactionStatus.COMPLETED);
      expect(result).toBe(completed);
      expect(repository.updateStatus).toHaveBeenCalledWith(
        transactionId,
        TransactionStatus.SENT_TO_PARTNER,
        TransactionStatus.COMPLETED,
        undefined,
      );
    });

    it("throws finalized error when a concurrent writer moved to a different terminal status", async () => {
      repository.findById
        .mockResolvedValueOnce(buildTransaction({ status: TransactionStatus.SENT_TO_PARTNER }))
        .mockResolvedValueOnce(buildTransaction({ status: TransactionStatus.REFUNDED }));
      repository.updateStatus.mockResolvedValue(false);

      await expect(service.updateStatus(transactionId, TransactionStatus.COMPLETED)).rejects.toBeInstanceOf(
        TransactionStatusAlreadyFinalizedError,
      );
    });

    it("throws TransactionNotFoundError when the row disappears after a guarded update", async () => {
      repository.findById
        .mockResolvedValueOnce(buildTransaction({ status: TransactionStatus.SENT_TO_PARTNER }))
        .mockResolvedValueOnce(null);
      repository.updateStatus.mockResolvedValue(true);

      await expect(service.updateStatus(transactionId, TransactionStatus.COMPLETED)).rejects.toBeInstanceOf(
        TransactionNotFoundError,
      );
    });
  });

  describe("cancelByUser", () => {
    const userId = "user-1";
    const transactionId = "11111111-1111-1111-1111-111111111111";

    it("transitions a CREATED transaction to CANCELLED through TransferStateService", async () => {
      const initial = buildTransaction({ status: TransactionStatus.CREATED });
      const cancelled = buildTransaction({ status: TransactionStatus.CANCELLED });
      repository.findByIdForUser.mockResolvedValue(initial);
      prisma.$queryRaw.mockResolvedValueOnce([{ id: transactionId, status: TransactionStatus.CREATED }]);
      prisma.transaction.findUnique.mockResolvedValueOnce(cancelled);

      const result = await service.cancelByUser(transactionId, userId, "test reason");

      expect(transferState.transition).toHaveBeenCalledWith(prisma, {
        transferId: transactionId,
        to: TransactionStatus.CANCELLED,
        actor: `user:${userId}`,
        reason: "test reason",
      });
      expect(result.status).toBe(TransactionStatus.CANCELLED);
    });

    it("allows cancelling from QUOTE_CONFIRMED (PRD §15.2 cancellable set)", async () => {
      const initial = buildTransaction({ status: TransactionStatus.QUOTE_CONFIRMED });
      const cancelled = buildTransaction({ status: TransactionStatus.CANCELLED });
      repository.findByIdForUser.mockResolvedValue(initial);
      prisma.$queryRaw.mockResolvedValueOnce([{ id: transactionId, status: TransactionStatus.QUOTE_CONFIRMED }]);
      prisma.transaction.findUnique.mockResolvedValueOnce(cancelled);

      const result = await service.cancelByUser(transactionId, userId);

      expect(transferState.transition).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ to: TransactionStatus.CANCELLED, actor: `user:${userId}` }),
      );
      expect(result.status).toBe(TransactionStatus.CANCELLED);
    });

    it("allows cancelling from EXPIRED (soft-terminal cleanup path)", async () => {
      const initial = buildTransaction({ status: TransactionStatus.EXPIRED });
      const cancelled = buildTransaction({ status: TransactionStatus.CANCELLED });
      repository.findByIdForUser.mockResolvedValue(initial);
      prisma.$queryRaw.mockResolvedValueOnce([{ id: transactionId, status: TransactionStatus.EXPIRED }]);
      prisma.transaction.findUnique.mockResolvedValueOnce(cancelled);

      const result = await service.cancelByUser(transactionId, userId);

      expect(transferState.transition).toHaveBeenCalled();
      expect(result.status).toBe(TransactionStatus.CANCELLED);
    });

    it("rejects PAYMENT_RECEIVED in pre-flight (PRD §15.4 — unwind must go through FAILED → REFUNDED)", async () => {
      const initial = buildTransaction({ status: TransactionStatus.PAYMENT_RECEIVED });
      repository.findByIdForUser.mockResolvedValue(initial);

      await expect(service.cancelByUser(transactionId, userId)).rejects.toBeInstanceOf(
        InvalidTransactionStatusTransitionError,
      );
      // Pre-flight rejection — we never open a transaction or invoke transition().
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(transferState.transition).not.toHaveBeenCalled();
    });

    it("rejects PROCESSING in pre-flight (state machine disallows direct cancel)", async () => {
      const initial = buildTransaction({ status: TransactionStatus.PROCESSING });
      repository.findByIdForUser.mockResolvedValue(initial);

      await expect(service.cancelByUser(transactionId, userId)).rejects.toBeInstanceOf(
        InvalidTransactionStatusTransitionError,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects PAYMENT_RECEIVED that drifted under the lock (pre-flight passed, status changed mid-flight)", async () => {
      // Caller saw CREATED in pre-flight, but a partner webhook landed
      // PAYMENT_RECEIVED before our FOR UPDATE acquired the lock.
      const initial = buildTransaction({ status: TransactionStatus.CREATED });
      repository.findByIdForUser.mockResolvedValue(initial);
      prisma.$queryRaw.mockResolvedValueOnce([{ id: transactionId, status: TransactionStatus.PAYMENT_RECEIVED }]);

      await expect(service.cancelByUser(transactionId, userId)).rejects.toBeInstanceOf(
        InvalidTransactionStatusTransitionError,
      );
      // Inner transition() was never reached — the in-transaction guard
      // returned a discriminated-union outcome instead of throwing.
      expect(transferState.transition).not.toHaveBeenCalled();
    });

    it("idempotent fast-path: already CANCELLED returns without calling transition", async () => {
      const initial = buildTransaction({ status: TransactionStatus.CANCELLED });
      repository.findByIdForUser.mockResolvedValue(initial);

      const result = await service.cancelByUser(transactionId, userId);

      expect(transferState.transition).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result.status).toBe(TransactionStatus.CANCELLED);
    });

    it("idempotent race-path: lock observes CANCELLED, returns current row without transition", async () => {
      const initial = buildTransaction({ status: TransactionStatus.CREATED });
      const cancelled = buildTransaction({ status: TransactionStatus.CANCELLED });
      repository.findByIdForUser.mockResolvedValue(initial);
      // FOR UPDATE returns the row with status already CANCELLED — someone else won the race.
      prisma.$queryRaw.mockResolvedValueOnce([{ id: transactionId, status: TransactionStatus.CANCELLED }]);
      prisma.transaction.findUnique.mockResolvedValueOnce(cancelled);

      const result = await service.cancelByUser(transactionId, userId);

      expect(transferState.transition).not.toHaveBeenCalled();
      expect(result.status).toBe(TransactionStatus.CANCELLED);
    });

    it("throws TransactionNotFoundError when the caller does not own the transaction", async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(service.cancelByUser(transactionId, userId)).rejects.toBeInstanceOf(TransactionNotFoundError);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("throws TransactionNotFoundError when the row disappears between pre-flight and lock", async () => {
      repository.findByIdForUser.mockResolvedValue(buildTransaction({ status: TransactionStatus.CREATED }));
      prisma.$queryRaw.mockResolvedValueOnce([]); // FOR UPDATE returns 0 rows

      await expect(service.cancelByUser(transactionId, userId)).rejects.toBeInstanceOf(TransactionNotFoundError);
      expect(transferState.transition).not.toHaveBeenCalled();
    });
  });
});
