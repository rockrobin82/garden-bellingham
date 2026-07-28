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

function logException(error: unknown, step: string): void {
  console.error(`${LOG_PREFIX} Exception at step: ${step}`);
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

  let step = "start";

  try {
    step = "Reading Google Sheets";
    console.log(`${LOG_PREFIX} 1. Reading Google Sheets`);
    const rawRows = await readSheetRange(SHEET_TABS.dates, "A:Z");

    step = "Google Sheets loaded";
    console.log(`${LOG_PREFIX} 2. Google Sheets loaded`);

    step = "Parsed rows count";
    const dateRows = parseDateRows(rawRows);
    console.log(`${LOG_PREFIX} 3. Parsed rows count:`, dateRows.length);

    step = "Booking row found";
    const dateRow = dateRows.find((row) => row.date === input.bookingDate);

    if (!dateRow) {
      throw new BookingDateNotFoundError(input.bookingDate);
    }

    console.log(`${LOG_PREFIX} 4. Booking row found`);
    console.log(`${LOG_PREFIX} Parsed booking row:`, dateRow);

    step = "Booking active";
    if (!dateRow.active) {
      throw new BookingDateInactiveError(input.bookingDate);
    }

    console.log(`${LOG_PREFIX} 5. Booking active`);

    const ticketQty = input.normalQty + input.reducedQty;
    const remaining = Math.max(0, dateRow.ticket_limit - dateRow.sold_count);

    if (ticketQty > remaining) {
      throw new InsufficientTicketsError(remaining);
    }

    step = "Pricing calculated";
    const pricing = calculateOrderPricing({
      normalQty: input.normalQty,
      reducedQty: input.reducedQty,
      priceNormalPln: dateRow.price_normal,
      priceReducedPln: dateRow.price_reduced,
    });
    console.log(`${LOG_PREFIX} 6. Pricing calculated:`, pricing);

    step = "Creating Supabase client";
    console.log(`${LOG_PREFIX} 7. Creating Supabase client`);
    const supabase = getSupabaseAdminClient();

    step = "Supabase client created";
    console.log(`${LOG_PREFIX} 8. Supabase client created`);

    step = "Insert payload ready";
    const insertPayload = {
      booking_date: input.bookingDate,
      customer_email: input.email,
      ticket_qty: pricing.ticketQty,
      normal_qty: pricing.normalQty,
      reduced_qty: pricing.reducedQty,
      unit_price_minor: pricing.unitPriceMinor,
      total_amount_minor: pricing.totalAmountMinor,
      payment_status: "pending" as const,
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
    };
    console.log(`${LOG_PREFIX} 9. Insert payload ready:`, insertPayload);

    step = "About to execute insert";
    console.log(`${LOG_PREFIX} 10. About to execute insert`);

    const { data, error } = await supabase
      .from("orders")
      .insert(insertPayload)
      .select("id, payment_status, total_amount_minor")
      .single();

    step = "Insert completed";
    console.log(`${LOG_PREFIX} 11. Insert completed`);

    if (error || !data) {
      console.error(
        `${LOG_PREFIX} Full Supabase error object:`,
        JSON.stringify(error, null, 2),
      );
      throw new Error(error?.message ?? "Failed to create order", {
        cause: error ?? undefined,
      });
    }

    step = "Order created successfully";
    console.log(`${LOG_PREFIX} 12. Order created successfully:`, {
      orderId: data.id,
      status: data.payment_status,
      totalAmountMinor: data.total_amount_minor,
    });

    return {
      orderId: data.id,
      status: "pending",
      totalAmountMinor: data.total_amount_minor,
    };
  } catch (error) {
    logException(error, step);
    throw error;
  }
}
