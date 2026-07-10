import { ZodError } from "zod";

import { checkInTicket } from "@/lib/tickets/check-in-ticket";
import { TicketRequestError } from "@/lib/tickets/errors";
import { checkInTicketRequestSchema } from "@/lib/validation/tickets";

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

    const parsed = checkInTicketRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 },
      );
    }

    const result = await checkInTicket(parsed.data.ticketCode);

    return Response.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof TicketRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to check in ticket.", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
