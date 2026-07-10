import { ZodError } from "zod";

import { handleP24WebhookNotification } from "@/lib/payments/handle-p24-webhook";
import { PaymentRequestError } from "@/lib/payments/errors";
import { p24TransactionNotificationSchema } from "@/lib/validation/payments";
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

    const parsed = p24TransactionNotificationSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 },
      );
    }

    await handleP24WebhookNotification(parsed.data);

    return new Response(null, { status: 200 });
  } catch (error) {
    if (error instanceof PaymentRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof P24ApiError || error instanceof P24NetworkError) {
      console.error("Przelewy24 transaction verification failed.", error);
      return Response.json(
        { error: "Payment provider error" },
        { status: 502 },
      );
    }

    console.error("Failed to handle Przelewy24 webhook.", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
