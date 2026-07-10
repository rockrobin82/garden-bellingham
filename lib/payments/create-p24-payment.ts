import "server-only";

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

export async function createP24Payment(
  orderId: string,
): Promise<CreateP24PaymentResponse> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, booking_date, customer_email, ticket_qty, total_amount_minor, payment_status, p24_token",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!order) {
    throw new OrderNotFoundError(orderId);
  }

  if (order.payment_status !== "pending") {
    throw new OrderNotPayableError(orderId);
  }

  const config = getP24Config();

  if (order.p24_token) {
    return {
      token: order.p24_token,
      redirectUrl: `${config.trnRequestBaseUrl}/trnRequest/${order.p24_token}`,
    };
  }

  const env = getEnv();
  const client = createP24Client(config);
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

  const result = await registerTransaction(client, config, {
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

  const { error: updateError } = await supabase
    .from("orders")
    .update({ p24_token: result.token })
    .eq("id", order.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    token: result.token,
    redirectUrl: result.redirectUrl,
  };
}
