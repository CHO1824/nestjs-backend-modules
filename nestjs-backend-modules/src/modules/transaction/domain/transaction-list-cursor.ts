import { InvalidTransactionListCursorError } from "../errors/transaction.error";

export interface TransactionListCursor {
  createdAt: string;
  id: string;
}

export function encodeTransactionListCursor(cursor: TransactionListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Round-trip check rejects "yyyy-mm-dd" and other Date.parse-permissive
// shapes that would not round-trip to the same string we emit on the way out.
function isValidCursorTimestamp(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

export function decodeTransactionListCursor(value: string): TransactionListCursor {
  let parsed: unknown;
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidTransactionListCursorError();
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as TransactionListCursor).createdAt !== "string" ||
    typeof (parsed as TransactionListCursor).id !== "string" ||
    !isValidCursorTimestamp((parsed as TransactionListCursor).createdAt) ||
    !UUID_PATTERN.test((parsed as TransactionListCursor).id)
  ) {
    throw new InvalidTransactionListCursorError();
  }

  return {
    createdAt: (parsed as TransactionListCursor).createdAt,
    id: (parsed as TransactionListCursor).id,
  };
}
