import {
  EntrySlotCapacityError,
  EntrySlotHoldConflictError,
  EntrySlotHoldInactiveError,
  EntrySlotInactiveError,
  EntrySlotLimitError,
  EntrySlotNotFoundError,
  EntrySlotQuantityError,
  EntrySlotUnavailableError,
  OrderRequestError,
} from "@/lib/orders/errors";

const SENSITIVE_TEXT = /postgres:\/\/|service_role|supabase_key|eyJ[A-Za-z0-9_-]{8,}|private_key|password|secret/i;

export function entrySlotErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    return typeof message === "string" ? message : "";
  }

  return "";
}

/**
 * Maps a Postgres/PostgREST reservation failure to a client-safe API error.
 * The original message is not returned.
 */
export function mapEntrySlotRpcError(error: unknown): OrderRequestError {
  const text = entrySlotErrorText(error);

  if (text.includes("SLOT_NOT_FOUND")) {
    return new EntrySlotNotFoundError();
  }

  if (text.includes("SLOT_INACTIVE")) {
    return new EntrySlotInactiveError();
  }

  if (text.includes("INSUFFICIENT_CAPACITY")) {
    return new EntrySlotCapacityError();
  }

  if (text.includes("HOLD_INACTIVE") || text.includes("HOLD_NOT_FOUND")) {
    return new EntrySlotHoldInactiveError();
  }

  if (text.includes("HOLD_CONFLICT")) {
    return new EntrySlotHoldConflictError();
  }

  if (text.includes("LIMIT_BELOW_COMMITTED") || text.includes("INVALID_LIMIT")) {
    return new EntrySlotLimitError();
  }

  if (text.includes("INVALID_QTY")) {
    return new EntrySlotQuantityError("Invalid ticket quantity");
  }

  if (SENSITIVE_TEXT.test(text)) {
    return new EntrySlotUnavailableError();
  }

  return new EntrySlotUnavailableError();
}
