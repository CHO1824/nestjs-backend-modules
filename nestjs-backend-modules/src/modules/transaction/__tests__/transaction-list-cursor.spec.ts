import { decodeTransactionListCursor, encodeTransactionListCursor } from "../domain/transaction-list-cursor";
import { InvalidTransactionListCursorError } from "../errors/transaction.error";

describe("transaction-list-cursor", () => {
  it("round-trips a cursor unchanged", () => {
    const cursor = {
      createdAt: "2026-05-01T12:34:56.000Z",
      id: "550e8400-e29b-41d4-a716-446655440000",
    };
    expect(decodeTransactionListCursor(encodeTransactionListCursor(cursor))).toEqual(cursor);
  });

  it("rejects non-base64 input", () => {
    expect(() => decodeTransactionListCursor("not a cursor")).toThrow(InvalidTransactionListCursorError);
  });

  it("rejects payload missing required fields", () => {
    const bad = Buffer.from(JSON.stringify({ createdAt: "2026-05-01T00:00:00.000Z" }), "utf8").toString("base64url");
    expect(() => decodeTransactionListCursor(bad)).toThrow(InvalidTransactionListCursorError);
  });

  it("rejects payload with non-ISO createdAt", () => {
    const bad = Buffer.from(
      JSON.stringify({
        createdAt: "yesterday",
        id: "550e8400-e29b-41d4-a716-446655440000",
      }),
      "utf8",
    ).toString("base64url");
    expect(() => decodeTransactionListCursor(bad)).toThrow(InvalidTransactionListCursorError);
  });

  it("rejects payload with non-UUID id", () => {
    const bad = Buffer.from(
      JSON.stringify({ createdAt: "2026-05-01T00:00:00.000Z", id: "not-a-uuid" }),
      "utf8",
    ).toString("base64url");
    expect(() => decodeTransactionListCursor(bad)).toThrow(InvalidTransactionListCursorError);
  });
});
