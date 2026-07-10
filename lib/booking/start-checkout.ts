import type {
  CreateOrderRequest,
  CreateOrderResponse,
  CreateP24PaymentResponse,
} from "@/types/booking";

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Creates an order and registers a Przelewy24 transaction.
 * Returns the URL the browser should navigate to for payment.
 */
export async function startCheckout(input: CreateOrderRequest): Promise<string> {
  const orderResponse = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!orderResponse.ok) {
    throw new Error(
      await readErrorMessage(orderResponse, "Nie udało się utworzyć zamówienia."),
    );
  }

  const order = (await orderResponse.json()) as CreateOrderResponse;

  const paymentResponse = await fetch("/api/payments/przelewy24/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: order.orderId }),
  });

  if (!paymentResponse.ok) {
    throw new Error(
      await readErrorMessage(
        paymentResponse,
        "Nie udało się rozpocząć płatności. Spróbuj ponownie.",
      ),
    );
  }

  const payment = (await paymentResponse.json()) as CreateP24PaymentResponse;
  return payment.redirectUrl;
}
