import { ZodError } from "zod";

import { createP24Payment } from "@/lib/payments/create-p24-payment";
import { PaymentRequestError } from "@/lib/payments/errors";
import { createP24PaymentRequestSchema } from "@/lib/validation/payments";
import { P24ApiError, P24NetworkError } from "@/lib/przelewy24";

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

    const parsed = createP24PaymentRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 },
      );
    }

    const result = await createP24Payment(parsed.data.orderId);

    return Response.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof PaymentRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof P24ApiError || error instanceof P24NetworkError) {
      console.error("Przelewy24 transaction registration failed.", error);
      return Response.json(
        { error: "Payment provider error" },
        { status: 502 },
      );
    }

    console.error("Failed to create Przelewy24 payment.", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
