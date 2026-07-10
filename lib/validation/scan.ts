import { z } from "zod";

export const scanTicketRequestSchema = z.object({
  ticketCode: z.string().trim().min(1),
});

export type ScanTicketRequest = z.infer<typeof scanTicketRequestSchema>;
