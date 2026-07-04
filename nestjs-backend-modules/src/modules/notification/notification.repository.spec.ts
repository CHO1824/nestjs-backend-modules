import { PrismaService } from "@/common/prisma/prisma.service";

import { NotificationRepository } from "./notification.repository";

/** Verifies deactivateDevicesByTokens dedupes input before the updateMany query. */
describe("NotificationRepository.deactivateDevicesByTokens", () => {
  let repo: NotificationRepository;
  let updateMany: jest.Mock;

  beforeEach(() => {
    updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { userDevice: { updateMany } } as unknown as PrismaService;
    repo = new NotificationRepository(prisma);
  });

  it("dedupes tokens before updateMany", async () => {
    await repo.deactivateDevicesByTokens(["a", "a", "b"]);

    expect(updateMany).toHaveBeenCalledWith({
      where: { token: { in: ["a", "b"] }, isActive: true },
      data: { isActive: false },
    });
  });

  it("returns count 0 without querying on an empty array", async () => {
    const result = await repo.deactivateDevicesByTokens([]);

    expect(updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ count: 0 });
  });
});
