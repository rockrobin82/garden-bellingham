import type {
  CreateEntrySlotOrderRequest,
  CreateOrderRequest,
} from "@/types/booking";

export function isEntrySlotOrderRequest(
  input: CreateOrderRequest | CreateEntrySlotOrderRequest,
): input is CreateEntrySlotOrderRequest {
  return Object.prototype.hasOwnProperty.call(input, "entrySlotId");
}

export function bodyRequestsEntrySlot(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    Object.prototype.hasOwnProperty.call(body, "entrySlotId")
  );
}
