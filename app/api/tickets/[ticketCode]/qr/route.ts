import { getTicketByCode } from "@/lib/tickets/get-ticket-by-code";
import { generateQrPng } from "@/lib/tickets/qr";

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
    const ticket = await getTicketByCode(ticketCode);

    if (!ticket) {
      return new Response("Not found", { status: 404 });
    }

    const png = await generateQrPng(ticket.qr_payload);

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate ticket QR code.", error);
    return new Response("Internal server error", { status: 500 });
  }
}
