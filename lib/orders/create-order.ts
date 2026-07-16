import "server-only";

import { calculateOrderPricing } from "@/lib/orders/calculate-order-pricing";
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

    const ticketQty = input.normalQty + input.reducedQty;
    const remaining = Math.max(0, dateRow.ticket_limit - dateRow.sold_count);

    if (ticketQty > remaining) {
      throw new InsufficientTicketsError(remaining);
    }

    const pricing = calculateOrderPricing({
      normalQty: input.normalQty,
      reducedQty: input.reducedQty,
      priceNormalPln: dateRow.price_normal,
      priceReducedPln: dateRow.price_reduced,
    });

    console.log(`${LOG_PREFIX} Creating Supabase admin client`);
    const supabase = getSupabaseAdminClient();
    console.log(`${LOG_PREFIX} Supabase client created`);

    const insertPayload = {
      booking_date: input.bookingDate,
      customer_email: input.email,
      ticket_qty: pricing.ticketQty,
      normal_qty: pricing.normalQty,
      reduced_qty: pricing.reducedQty,
      unit_price_minor: pricing.unitPriceMinor,
      total_amount_minor: pricing.totalAmountMinor,
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
