import { z } from "zod";

export const checkInTicketRequestSchema = z.object({
  ticketCode: z.string().trim().min(1),
});

export type CheckInTicketRequest = z.infer<typeof checkInTicketRequestSchema>;
