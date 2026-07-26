import { ZodError } from "zod";

import { AdminUnauthorizedError, requireAdminSession } from "@/lib/admin/require-admin";
import {
  OrderAlreadyRefundedError,
  PaymentRequestError,
} from "@/lib/payments/errors";
import { processOrderRefund } from "@/lib/payments/process-order-refund";
import { P24ApiError, P24NetworkError } from "@/lib/przelewy24";
import { adminRefundRequestSchema } from "@/lib/validation/refund";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOG_PREFIX = "[POST /api/admin/orders/:id/refund]";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function formatValidationError(error: ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    await requireAdminSession();

    const { id: orderId } = await context.params;

    let body: unknown = {};
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    }

    const parsed = adminRefundRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return Response.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 },
      );
    }

    const result = await processOrderRefund(orderId, parsed.data.reason);

    return Response.json(
      {
        orderId: result.orderId,
        refundId: result.refundId,
        refundAmountMinor: result.refundAmountMinor,
        refundReason: result.refundReason,
        refundedAt: result.refundedAt,
        paymentStatus: "refunded",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof OrderAlreadyRefundedError) {
      return Response.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof PaymentRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof P24ApiError || error instanceof P24NetworkError) {
      console.error(`${LOG_PREFIX} Przelewy24 error.`, error);
      return Response.json(
        { error: "Payment provider error" },
        { status: 502 },
      );
    }

    console.error(`${LOG_PREFIX} Unexpected error.`, error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
