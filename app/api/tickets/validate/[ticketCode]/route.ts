import { validateTicket } from "@/lib/tickets/validate-ticket";
import { TicketNotFoundError } from "@/lib/tickets/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ ticketCode: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const { ticketCode } = await context.params;
    const result = await validateTicket(ticketCode);

    return Response.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof TicketNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to validate ticket.", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
