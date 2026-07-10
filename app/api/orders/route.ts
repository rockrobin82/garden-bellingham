import { ZodError } from "zod";

import { createOrder } from "@/lib/orders/create-order";
import { OrderRequestError } from "@/lib/orders/errors";
import { createOrderRequestSchema } from "@/lib/validation/orders";
import type { CreateOrderResponse } from "@/types/booking";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOG_PREFIX = "[POST /api/orders]";

function formatValidationError(error: ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSupabaseError(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.message === "string" &&
    ("code" in value || "details" in value || "hint" in value)
  );
}

function logOrdersRouteError(error: unknown): void {
  console.error(LOG_PREFIX, error);

  if (error instanceof Error) {
    console.error(`${LOG_PREFIX} error.message:`, error.message);

    if (error.stack) {
      console.error(`${LOG_PREFIX} error.stack:`, error.stack);
    }

    if (error.cause !== undefined) {
      console.error(`${LOG_PREFIX} error.cause:`, error.cause);

      if (isSupabaseError(error.cause)) {
        console.error(`${LOG_PREFIX} supabase error:`, error.cause);
      }
    }
  } else if (isRecord(error) && typeof error.message === "string") {
    console.error(`${LOG_PREFIX} error.message:`, error.message);
  }

  if (isSupabaseError(error)) {
    console.error(`${LOG_PREFIX} supabase error:`, error);
  }
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

    logOrdersRouteError(error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
