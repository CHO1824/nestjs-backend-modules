import * as admin from "firebase-admin";

import { PushDeliveryError } from "../errors/notification.errors";
import { RenderedContent } from "../interfaces/notification-sender.interface";
import { NotificationRepository } from "../notification.repository";
import { PushSender } from "./push.sender";

// Non-empty admin.apps keeps PushSender on the real send path (not the MOCK bail-out).
jest.mock("firebase-admin", () => ({
  apps: [{}],
  messaging: jest.fn(),
}));

const content: RenderedContent = { title: "t", message: "m" };

// Build an FCM-shaped BatchResponse from a list of error codes (null = success).
const makeResponse = (codes: (string | null)[]): admin.messaging.BatchResponse =>
  ({
    successCount: codes.filter((c) => c === null).length,
    failureCount: codes.filter((c) => c !== null).length,
    responses: codes.map((code) => (code === null ? { success: true } : { success: false, error: { code } })),
  }) as admin.messaging.BatchResponse;

/** Verifies PushSender tags each FCM failure permanent/transient via PushDeliveryError. */
describe("PushSender — failure classification (transient/permanent)", () => {
  let sender: PushSender;
  let sendEachForMulticast: jest.Mock;

  beforeEach(() => {
    sendEachForMulticast = jest.fn();
    (admin.messaging as unknown as jest.Mock).mockReturnValue({ sendEachForMulticast });
    // Dead-token cleanup runs before the throw; give it a resolving repository.
    const repository = { deactivateDevicesByTokens: jest.fn().mockResolvedValue({ count: 0 }) };
    sender = new PushSender(repository as unknown as NotificationRepository);
  });

  it("classifies an all-invalid-token batch as PERMANENT", async () => {
    sendEachForMulticast.mockResolvedValue(makeResponse(["messaging/registration-token-not-registered"]));

    const error = await sender.send("ob-1", "tok", content).catch((e) => e);

    expect(error).toBeInstanceOf(PushDeliveryError);
    expect(error.permanent).toBe(true);
  });

  it("classifies a 5xx / internal-error batch as TRANSIENT", async () => {
    sendEachForMulticast.mockResolvedValue(makeResponse(["messaging/internal-error"]));

    const error = await sender.send("ob-1", "tok", content).catch((e) => e);

    expect(error).toBeInstanceOf(PushDeliveryError);
    expect(error.permanent).toBe(false);
  });

  it("treats a mixed batch (one token transient) as TRANSIENT — a retry could still help", async () => {
    sendEachForMulticast.mockResolvedValue(
      makeResponse(["messaging/registration-token-not-registered", "messaging/internal-error"]),
    );

    const error = await sender.send("ob-1", ["a", "b"], content).catch((e) => e);

    expect(error.permanent).toBe(false);
  });

  it("treats an SDK throw (no per-token response) as TRANSIENT", async () => {
    sendEachForMulticast.mockRejectedValue(new Error("ECONNRESET"));

    const error = await sender.send("ob-1", "tok", content).catch((e) => e);

    expect(error).toBeInstanceOf(PushDeliveryError);
    expect(error.permanent).toBe(false);
  });

  it("treats an SDK throw carrying a permanent FCM error code as PERMANENT", async () => {
    // e.g. bad credential / invalid argument — retrying never helps.
    const sdkError = Object.assign(new Error("Invalid registration token"), {
      code: "messaging/invalid-registration-token",
    });
    sendEachForMulticast.mockRejectedValue(sdkError);

    const error = await sender.send("ob-1", "tok", content).catch((e) => e);

    expect(error).toBeInstanceOf(PushDeliveryError);
    expect(error.permanent).toBe(true);
  });

  it("does not throw when at least one token succeeds", async () => {
    sendEachForMulticast.mockResolvedValue(makeResponse([null, "messaging/internal-error"]));

    await expect(sender.send("ob-1", ["a", "b"], content)).resolves.toBeUndefined();
  });
});

/** Verifies PushSender deactivates dead/unregistered tokens after a send. */
describe("PushSender — dead token cleanup", () => {
  let sender: PushSender;
  let sendEachForMulticast: jest.Mock;
  let repository: { deactivateDevicesByTokens: jest.Mock };

  beforeEach(() => {
    sendEachForMulticast = jest.fn();
    (admin.messaging as unknown as jest.Mock).mockReturnValue({ sendEachForMulticast });
    repository = { deactivateDevicesByTokens: jest.fn().mockResolvedValue({ count: 1 }) };
    sender = new PushSender(repository as unknown as NotificationRepository);
  });

  it("deactivates a token FCM reports as unregistered", async () => {
    sendEachForMulticast.mockResolvedValue(makeResponse([null, "messaging/registration-token-not-registered"]));

    await sender.send("ob-1", ["good", "dead"], content);

    expect(repository.deactivateDevicesByTokens).toHaveBeenCalledWith(["dead"]);
  });

  it("does not deactivate when all tokens are healthy", async () => {
    sendEachForMulticast.mockResolvedValue(makeResponse([null]));

    await sender.send("ob-1", "good", content);

    expect(repository.deactivateDevicesByTokens).not.toHaveBeenCalled();
  });

  it("deactivates only the dead token in a mixed (dead + transient) batch", async () => {
    sendEachForMulticast.mockResolvedValue(
      makeResponse(["messaging/registration-token-not-registered", "messaging/internal-error"]),
    );

    // All failed → send throws, but the cleanup runs before the throw.
    await sender.send("ob-1", ["dead", "transient"], content).catch(() => undefined);

    expect(repository.deactivateDevicesByTokens).toHaveBeenCalledWith(["dead"]);
  });

  it("ignores a dead response with no matching token (array mismatch)", async () => {
    // 1 token but 2 responses → the dead response maps to tokens[1] (undefined),
    // which must be filtered out rather than passed to the repository.
    sendEachForMulticast.mockResolvedValue(makeResponse([null, "messaging/registration-token-not-registered"]));

    await sender.send("ob-1", ["good"], content);

    expect(repository.deactivateDevicesByTokens).not.toHaveBeenCalled();
  });

  it("does not deactivate transient-only failures (e.g. internal-error)", async () => {
    sendEachForMulticast.mockResolvedValue(makeResponse(["messaging/internal-error"]));

    await sender.send("ob-1", "tok", content).catch(() => undefined);

    expect(repository.deactivateDevicesByTokens).not.toHaveBeenCalled();
  });

  it("does not mask the send result when cleanup fails", async () => {
    repository.deactivateDevicesByTokens.mockRejectedValue(new Error("db down"));
    sendEachForMulticast.mockResolvedValue(makeResponse([null, "messaging/registration-token-not-registered"]));

    await expect(sender.send("ob-1", ["good", "dead"], content)).resolves.toBeUndefined();
  });
});
