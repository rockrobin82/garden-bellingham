import { ZodError } from "zod";

import { scanTicket } from "@/lib/tickets/scan-ticket";
import { scanTicketRequestSchema } from "@/lib/validation/scan";

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

    const parsed = scanTicketRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 },
      );
    }

    const result = await scanTicket(parsed.data.ticketCode);

    switch (result.status) {
      case "NOT_FOUND":
        return Response.json(result, {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        });
      case "CANCELLED":
        return Response.json(result, {
          status: 409,
          headers: { "Cache-Control": "no-store" },
        });
      case "USED":
      case "VALID":
        return Response.json(result, {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        });
    }
  } catch (error) {
    console.error("Failed to scan ticket.", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
