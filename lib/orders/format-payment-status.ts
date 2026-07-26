import type { PaymentStatus } from "@/types/database";

export function formatPaymentStatus(status: PaymentStatus): string {
  switch (status) {
    case "pending":
      return "Oczekuje";
    case "paid":
      return "Opłacone";
    case "failed":
      return "Nieudane";
    case "cancelled":
      return "Anulowane";
    case "refunded":
      return "Zwrócone";
    default:
      return status;
  }
}
