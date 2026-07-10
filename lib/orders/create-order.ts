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

const LOG_PREFIX = "[createOrder]";

function plnToMinor(amountPln: number): number {
  return Math.round(amountPln * 100);
}

function logException(error: unknown): void {
  console.error(`${LOG_PREFIX} Exception:`, error);

  if (error instanceof Error && error.stack) {
    console.error(`${LOG_PREFIX} Stack trace:`, error.stack);
  }
}

export async function createOrder(
  input: CreateOrderRequest,
): Promise<CreateOrderResponse> {
  console.log(`${LOG_PREFIX} Creating order started`);
  console.log(`${LOG_PREFIX} Request payload:`, input);

  try {
    console.log(`${LOG_PREFIX} Reading Google Sheets`);
    const rawRows = await readSheetRange(SHEET_TABS.dates, "A:Z");
    const dateRows = parseDateRows(rawRows);
    const dateRow = dateRows.find((row) => row.date === input.bookingDate);

    if (!dateRow) {
      throw new BookingDateNotFoundError(input.bookingDate);
    }

    console.log(`${LOG_PREFIX} Booking date found`);
    console.log(`${LOG_PREFIX} Parsed booking row:`, dateRow);

    if (!dateRow.active) {
      throw new BookingDateInactiveError(input.bookingDate);
    }

    const remaining = Math.max(0, dateRow.ticket_limit - dateRow.sold_count);

    if (input.ticketQty > remaining) {
      throw new InsufficientTicketsError(remaining);
    }

    const unitPriceMinor = plnToMinor(dateRow.price_normal);
    const totalAmountMinor = unitPriceMinor * input.ticketQty;

    console.log(`${LOG_PREFIX} Creating Supabase admin client`);
    const supabase = getSupabaseAdminClient();
    console.log(`${LOG_PREFIX} Supabase client created`);

    const insertPayload = {
      booking_date: input.bookingDate,
      customer_email: input.email,
      ticket_qty: input.ticketQty,
      unit_price_minor: unitPriceMinor,
      total_amount_minor: totalAmountMinor,
      payment_status: "pending" as const,
    };

    console.log(`${LOG_PREFIX} About to insert order`);
    console.log(`${LOG_PREFIX} Full insert payload:`, insertPayload);

    const { data, error } = await supabase
      .from("orders")
      .insert(insertPayload)
      .select("id, payment_status, total_amount_minor")
      .single();

    if (error || !data) {
      console.error(
        `${LOG_PREFIX} Full Supabase error object:`,
        JSON.stringify(error, null, 2),
      );
      throw new Error(error?.message ?? "Failed to create order", {
        cause: error ?? undefined,
      });
    }

    return {
      orderId: data.id,
      status: "pending",
      totalAmountMinor: data.total_amount_minor,
    };
  } catch (error) {
    logException(error);
    throw error;
  }
}
