import { randomBytes } from "crypto";

/**
 * Generates a globally unique ticket code.
 */
export function generateTicketCode(): string {
  return randomBytes(16).toString("hex").toUpperCase();
}
