import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ZodError } from "zod";

import { calculateOrderPricing } from "@/lib/orders/calculate-order-pricing";
import {
  EntrySlotCapacityError,
  EntrySlotDateMismatchError,
  EntrySlotHoldConflictError,
  EntrySlotInactiveError,
  EntrySlotNotFoundError,
  EntrySlotOrderLimitError,
  EntrySlotQuantityError,
  EntrySlotSheetError,
  EntrySlotUnavailableError,
  OrderRequestError,
} from "@/lib/orders/errors";
import { mapEntrySlotRpcError } from "@/lib/orders/map-entry-slot-rpc-error";
import { parseEntrySlotRows } from "@/lib/sheets/parse-entry-slots";
import type { Database, EntrySlotHoldRow } from "@/types/database";
import type {
  CreateEntrySlotOrderRequest,
  CreateOrderResponse,
} from "@/types/booking";
import type { EntrySlotRow } from "@/types/sheets";
import { parseCreateEntrySlotOrderRequest } from "@/lib/validation/orders";

const LOG_PREFIX = "[createEntrySlotOrder]";
const RESERVATION_INCOMPLETE = "incomplete";
const RESERVATION_HELD = "held";

type AdminClient = SupabaseClient<Database>;

type StoredOrder = {
  id: string;
  payment_status: string;
  total_amount_minor: number;
  booking_date: string;
  customer_email: string;
  normal_qty: number;
  reduced_qty: number;
  entry_slot_id: string | null;
  entry_time_start: string | null;
  entry_time_end: string | null;
  payment_metadata: Record<string, unknown> | null;
};

export type CreateEntrySlotOrderDependencies = {
  readDateSheet?: () => Promise<string[][]>;
  supabase?: AdminClient;
  beforeReserve?: () => Promise<void> | void;
};

const ORDER_SELECT =
  "id, payment_status, total_amount_minor, booking_date, customer_email, normal_qty, reduced_qty, entry_slot_id, entry_time_start, entry_time_end, payment_metadata" as const;

function reservationState(
  metadata: Record<string, unknown> | null,
): string | null {
  const value = metadata?.entry_slot_reservation;
  return typeof value === "string" ? value : null;
}

function toResponse(order: StoredOrder): CreateOrderResponse {
  return {
    orderId: order.id,
    status: "pending",
    totalAmountMinor: order.total_amount_minor,
  };
}

function unwrapHold(data: EntrySlotHoldRow | EntrySlotHoldRow[] | null): EntrySlotHoldRow | null {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }
  return data;
}

function parseInput(input: CreateEntrySlotOrderRequest): CreateEntrySlotOrderRequest {
  try {
    return parseCreateEntrySlotOrderRequest(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new EntrySlotQuantityError(
        error.issues.map((issue) => issue.message).join("; "),
      );
    }
    throw error;
  }
}

async function defaultDependencies(): Promise<
  Required<Pick<CreateEntrySlotOrderDependencies, "readDateSheet" | "supabase">>
> {
  const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const { readSheetRange } = await import("@/lib/sheets/helpers");
  const { SHEET_TABS } = await import("@/lib/sheets/schema");

  return {
    supabase: getSupabaseAdminClient(),
    readDateSheet: () => readSheetRange(SHEET_TABS.dates, "A:Z"),
  };
}

async function loadSheetSlot(
  readDateSheet: () => Promise<string[][]>,
  entrySlotId: string,
  bookingDate: string,
): Promise<EntrySlotRow> {
  let rows: string[][];

  try {
    rows = await readDateSheet();
  } catch (error) {
    console.error(`${LOG_PREFIX} Google Sheets read failed.`, error);
    throw new EntrySlotSheetError();
  }

  let slots: EntrySlotRow[];

  try {
    slots = parseEntrySlotRows(rows);
  } catch (error) {
    console.error(`${LOG_PREFIX} Entry slot sheet parse failed.`, error);
    throw new EntrySlotSheetError();
  }

  const slot = slots.find((row) => row.slot_id === entrySlotId);

  if (!slot) {
    throw new EntrySlotNotFoundError();
  }

  if (slot.date !== bookingDate) {
    throw new EntrySlotDateMismatchError();
  }

  return slot;
}

async function findOrder(
  supabase: AdminClient,
  idempotencyKey: string,
): Promise<StoredOrder | null> {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("entry_slot_idempotency_key", idempotencyKey)
      .maybeSingle();

    if (error) {
      console.error(`${LOG_PREFIX} Order lookup failed.`, error);
      throw new EntrySlotUnavailableError();
    }

    return data;
  } catch (error) {
    if (error instanceof OrderRequestError) {
      throw error;
    }
    console.error(`${LOG_PREFIX} Order lookup failed.`, error);
    throw new EntrySlotUnavailableError();
  }
}

function assertSameRequest(order: StoredOrder, input: CreateEntrySlotOrderRequest): void {
  const sameRequest =
    order.entry_slot_id === input.entrySlotId &&
    order.booking_date === input.bookingDate &&
    order.customer_email === input.email &&
    order.normal_qty === input.normalQty &&
    order.reduced_qty === input.reducedQty;

  if (!sameRequest) {
    throw new EntrySlotHoldConflictError();
  }
}

async function syncSlot(supabase: AdminClient, slot: EntrySlotRow): Promise<void> {
  try {
    const { error } = await supabase.rpc("sync_entry_slot_limit", {
      p_slot_id: slot.slot_id,
      p_ticket_limit: slot.ticket_limit,
      p_active: slot.active,
    });

    if (error) {
      console.error(`${LOG_PREFIX} sync_entry_slot_limit failed.`, error);
      throw mapEntrySlotRpcError(error);
    }
  } catch (error) {
    if (error instanceof OrderRequestError) {
      throw error;
    }
    console.error(`${LOG_PREFIX} sync_entry_slot_limit failed.`, error);
    throw new EntrySlotUnavailableError();
  }
}

async function reserveSlot(
  supabase: AdminClient,
  orderId: string,
  slotId: string,
  qty: number,
): Promise<EntrySlotHoldRow> {
  try {
    const { data, error } = await supabase.rpc("reserve_entry_slot", {
      p_slot_id: slotId,
      p_order_id: orderId,
      p_qty: qty,
    });

    if (error) {
      console.error(`${LOG_PREFIX} reserve_entry_slot failed.`, error);
      throw mapEntrySlotRpcError(error);
    }

    const hold = unwrapHold(data);

    if (!hold) {
      throw new EntrySlotUnavailableError();
    }

    return hold;
  } catch (error) {
    if (error instanceof OrderRequestError) {
      throw error;
    }
    console.error(`${LOG_PREFIX} reserve_entry_slot failed.`, error);
    throw new EntrySlotUnavailableError();
  }
}

async function markHeld(
  supabase: AdminClient,
  orderId: string,
  holdId: string,
): Promise<StoredOrder> {
  const { data, error } = await supabase
    .from("orders")
    .update({
      payment_status: "pending",
      payment_metadata: {
        entry_slot_reservation: RESERVATION_HELD,
        entry_slot_hold_id: holdId,
      },
    })
    .eq("id", orderId)
    .eq("payment_status", "cancelled")
    .select(ORDER_SELECT)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Failed to publish held order.`, error);
    throw new EntrySlotUnavailableError();
  }

  if (data) {
    return data;
  }

  const current = await findOrderById(supabase, orderId);

  if (current?.payment_status === "pending") {
    return current;
  }

  throw new EntrySlotUnavailableError();
}

async function findOrderById(
  supabase: AdminClient,
  orderId: string,
): Promise<StoredOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Order reload failed.`, error);
    throw new EntrySlotUnavailableError();
  }

  return data;
}

async function insertIncompleteOrder(
  supabase: AdminClient,
  input: CreateEntrySlotOrderRequest,
  slot: EntrySlotRow,
  pricing: ReturnType<typeof calculateOrderPricing>,
): Promise<StoredOrder> {
  const { data, error } = await supabase
    .from("orders")
    .insert({
      booking_date: input.bookingDate,
      customer_email: input.email,
      ticket_qty: pricing.ticketQty,
      normal_qty: pricing.normalQty,
      reduced_qty: pricing.reducedQty,
      unit_price_minor: pricing.unitPriceMinor,
      total_amount_minor: pricing.totalAmountMinor,
      payment_status: "cancelled",
      invoice_requested: input.invoiceRequested,
      invoice_company_name: input.invoiceRequested
        ? input.invoiceCompanyName ?? null
        : null,
      invoice_nip: input.invoiceRequested ? input.invoiceNip ?? null : null,
      invoice_street: input.invoiceRequested ? input.invoiceStreet ?? null : null,
      invoice_postal_code: input.invoiceRequested
        ? input.invoicePostalCode ?? null
        : null,
      invoice_city: input.invoiceRequested ? input.invoiceCity ?? null : null,
      invoice_issued: false,
      entry_slot_id: slot.slot_id,
      entry_time_start: slot.time_start,
      entry_time_end: slot.time_end,
      entry_slot_idempotency_key: input.idempotencyKey,
      payment_metadata: {
        entry_slot_reservation: RESERVATION_INCOMPLETE,
      },
    })
    .select(ORDER_SELECT)
    .single();

  if (error?.code === "23505") {
    const existing = await findOrder(supabase, input.idempotencyKey);
    if (!existing) {
      throw new EntrySlotUnavailableError();
    }
    assertSameRequest(existing, input);
    return existing;
  }

  if (error || !data) {
    console.error(`${LOG_PREFIX} Order insert failed.`, error);
    throw new EntrySlotUnavailableError();
  }

  return data;
}

async function resumeIncompleteOrder(
  supabase: AdminClient,
  order: StoredOrder,
  slot: EntrySlotRow,
  qty: number,
  beforeReserve?: () => Promise<void> | void,
): Promise<CreateOrderResponse> {
  try {
    return await publishReservation(supabase, order, qty, beforeReserve);
  } catch (error) {
    if (
      error instanceof EntrySlotNotFoundError ||
      error instanceof EntrySlotInactiveError ||
      error instanceof EntrySlotCapacityError
    ) {
      await syncSlot(supabase, slot);
      return publishReservation(supabase, order, qty);
    }

    throw error;
  }
}

async function publishReservation(
  supabase: AdminClient,
  order: StoredOrder,
  qty: number,
  beforeReserve?: () => Promise<void> | void,
): Promise<CreateOrderResponse> {
  if (beforeReserve) {
    await beforeReserve();
  }

  if (!order.entry_slot_id) {
    throw new EntrySlotHoldConflictError();
  }

  const hold = await reserveSlot(supabase, order.id, order.entry_slot_id, qty);

  if (order.payment_status === "pending") {
    return toResponse(order);
  }

  const published = await markHeld(supabase, order.id, hold.id);
  return toResponse(published);
}

/**
 * Creates a pending order bound to one entry slot and reserves its seats.
 * Capacity comes from reserve_entry_slot, not from the sheet sold_count.
 * The public checkout route still rejects entrySlotId. Callers must pass a local client in tests.
 */
export async function createEntrySlotOrder(
  input: CreateEntrySlotOrderRequest,
  dependencies: CreateEntrySlotOrderDependencies = {},
): Promise<CreateOrderResponse> {
  const parsed = parseInput(input);
  const defaults =
    dependencies.supabase && dependencies.readDateSheet
      ? null
      : await defaultDependencies();
  const supabase = dependencies.supabase ?? defaults?.supabase;
  const readDateSheet = dependencies.readDateSheet ?? defaults?.readDateSheet;

  if (!supabase || !readDateSheet) {
    throw new EntrySlotUnavailableError();
  }

  const slot = await loadSheetSlot(
    readDateSheet,
    parsed.entrySlotId,
    parsed.bookingDate,
  );
  const pricing = calculateOrderPricing({
    normalQty: parsed.normalQty,
    reducedQty: parsed.reducedQty,
    priceNormalPln: slot.price_normal,
    priceReducedPln: slot.price_reduced,
  });

  if (pricing.ticketQty <= 0) {
    throw new EntrySlotQuantityError();
  }

  if (pricing.ticketQty > slot.max_tickets_per_order) {
    throw new EntrySlotOrderLimitError();
  }

  const existing = await findOrder(supabase, parsed.idempotencyKey);

  if (existing) {
    assertSameRequest(existing, parsed);

    if (existing.payment_status === "pending") {
      return publishReservation(supabase, existing, pricing.ticketQty);
    }

    if (reservationState(existing.payment_metadata) === RESERVATION_INCOMPLETE) {
      return resumeIncompleteOrder(
        supabase,
        existing,
        slot,
        pricing.ticketQty,
        dependencies.beforeReserve,
      );
    }

    throw new EntrySlotHoldConflictError();
  }

  try {
    await syncSlot(supabase, slot);
  } catch (error) {
    if (error instanceof OrderRequestError) {
      throw error;
    }
    console.error(`${LOG_PREFIX} Slot sync failed before insert.`, error);
    throw mapEntrySlotRpcError(error);
  }

  const order = await insertIncompleteOrder(supabase, parsed, slot, pricing);

  if (reservationState(order.payment_metadata) !== RESERVATION_INCOMPLETE) {
    assertSameRequest(order, parsed);
    return publishReservation(
      supabase,
      order,
      pricing.ticketQty,
      dependencies.beforeReserve,
    );
  }

  return publishReservation(
    supabase,
    order,
    pricing.ticketQty,
    dependencies.beforeReserve,
  );
}
