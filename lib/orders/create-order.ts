import "server-only";

import {
  BookingDateInactiveError,
  BookingDateNotFoundError,
  InsufficientTicketsError,
} from "@/lib/orders/errors";
import { readSheetRange, parseDateRows } from "@/lib/sheets/helpers";
import { SHEET_TABS } from "@/lib/sheets/schema";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CreateOrderRequest, CreateOrderResponse } from "@/types/booking";

function plnToMinor(amountPln: number): number {
  return Math.round(amountPln * 100);
}

export async function createOrder(
  input: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  const rawRows = await readSheetRange(SHEET_TABS.dates, "A:Z");
  const dateRows = parseDateRows(rawRows);
  const dateRow = dateRows.find((row) => row.date === input.bookingDate);

  if (!dateRow) {
    throw new BookingDateNotFoundError(input.bookingDate);
  }

  if (!dateRow.active) {
    throw new BookingDateInactiveError(input.bookingDate);
  }

  const remaining = Math.max(0, dateRow.ticket_limit - dateRow.sold_count);

  if (input.ticketQty > remaining) {
    throw new InsufficientTicketsError(remaining);
  }

  const unitPriceMinor = plnToMinor(dateRow.price_normal);
  const totalAmountMinor = unitPriceMinor * input.ticketQty;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      booking_date: input.bookingDate,
      customer_email: input.email,
      ticket_qty: input.ticketQty,
      unit_price_minor: unitPriceMinor,
      total_amount_minor: totalAmountMinor,
      payment_status: "pending",
    })
    .select("id, payment_status, total_amount_minor")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create order", {
      cause: error ?? undefined,
    });
  }

  return {
    orderId: data.id,
    status: "pending",
    totalAmountMinor: data.total_amount_minor,
  };
}
