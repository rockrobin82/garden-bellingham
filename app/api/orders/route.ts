import { ZodError } from "zod";

import { createOrder } from "@/lib/orders/create-order";
import { OrderRequestError } from "@/lib/orders/errors";
import { createOrderRequestSchema } from "@/lib/validation/orders";
import type { CreateOrderResponse } from "@/types/booking";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatValidationError(error: ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

export async function POST(request: Request): Promise<Response> {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createOrderRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 },
      );
    }

    const result: CreateOrderResponse = await createOrder(parsed.data);

    return Response.json(result, {
      status: 201,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof OrderRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to create order.", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
