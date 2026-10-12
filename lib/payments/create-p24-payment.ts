import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/config/env";
import {
  OrderNotFoundError,
  OrderNotPayableError,
} from "@/lib/payments/errors";
import {
  createP24Client,
  getP24Config,
  registerTransaction,
} from "@/lib/przelewy24";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CreateP24PaymentResponse } from "@/types/booking";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export type CreateP24PaymentDependencies = {
  supabase?: AdminClient;
  registerTransaction?: (input: {
    orderId: string;
    amountMinor: number;
    bookingDate: string;
    email: string;
  }) => Promise<{ token: string; redirectUrl: string }>;
};

const LOG_PREFIX = "[createP24Payment]";

export async function createP24Payment(
  orderId: string,
  dependencies: CreateP24PaymentDependencies = {},
): Promise<CreateP24PaymentResponse> {
  const supabase = dependencies.supabase ?? getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, booking_date, customer_email, ticket_qty, total_amount_minor, payment_status, p24_token, entry_slot_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Order read failed.`, error);
    throw new Error("Payment could not be started");
  }

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  if (order.payment_status !== "pending") {
    throw new OrderNotPayableError(orderId);
  }

  if (order.entry_slot_id) {
    await assertActiveEntrySlotHold(supabase, order.id, order.entry_slot_id);
  }

  if (order.p24_token) {
    const config = getP24Config();
    return {
      token: order.p24_token,
      redirectUrl: `${config.trnRequestBaseUrl}/trnRequest/${order.p24_token}`,
    };
  }

  const result = dependencies.registerTransaction
    ? await dependencies.registerTransaction({
        orderId: order.id,
        amountMinor: order.total_amount_minor,
        bookingDate: order.booking_date,
        email: order.customer_email,
      })
    : await registerLiveTransaction(order);

  const { error: updateError } = await supabase
    .from("orders")
    .update({ p24_token: result.token })
    .eq("id", order.id);

  if (updateError) {
    console.error(`${LOG_PREFIX} Token update failed.`, updateError);
    throw new Error("Payment could not be started");
  }

  return {
    token: result.token,
    redirectUrl: result.redirectUrl,
  };
}

async function assertActiveEntrySlotHold(
  supabase: AdminClient,
  orderId: string,
  slotId: string,
): Promise<void> {
  const { data: hold, error } = await supabase
    .from("entry_slot_holds")
    .select("status, slot_id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Hold lookup failed.`, error);
    throw new Error("Payment could not be started");
  }

  if (!hold || hold.status !== "held" || hold.slot_id !== slotId) {
    throw new OrderNotPayableError(orderId);
  }
}

async function registerLiveTransaction(order: {
  id: string;
  booking_date: string;
  customer_email: string;
  total_amount_minor: number;
}): Promise<{ token: string; redirectUrl: string }> {
  const config = getP24Config();
  const env = getEnv();
  const client = createP24Client(config);
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  return registerTransaction(client, config, {
    sessionId: order.id,
    amount: order.total_amount_minor,
    currency: "PLN",
    description: `Rezerwacja ogrodu – ${order.booking_date}`,
    email: order.customer_email,
    country: "PL",
    language: "pl",
    urlReturn: `${appUrl}/payment/success`,
    urlStatus: `${appUrl}/api/payments/przelewy24/webhook`,
  });
}
