import type { PaymentStatus } from "@/types/database";

export const ORDER_SUPPORT_EMAIL = "biuro@angielskieogrody.com";

export type CustomerTicketSection =
  | {
      kind: "review";
      heading: string;
      body: string;
      email: string;
      contactPath: "/kontakt";
    }
  | { kind: "empty"; message: string }
  | { kind: "tickets"; intro: string };

export function adminPaymentStatusDescription(status: PaymentStatus): string {
  switch (status) {
    case "pending":
      return "Płatność nie została jeszcze potwierdzona.";
    case "paid":
      return "Płatność została zaksięgowana.";
    case "failed":
      return "Płatność nie doszła do skutku.";
    case "cancelled":
      return "Zamówienie zostało anulowane.";
    case "refunded":
      return "Zwrot został zapisany.";
    case "review":
      return "Płatność wymaga ręcznej weryfikacji. Bilety nie zostały utworzone.";
    default:
      return status;
  }
}

export function adminTicketsEmptyCopy(status: PaymentStatus): {
  title: string;
  description: string;
} {
  if (status === "review") {
    return {
      title: "Brak biletów",
      description:
        "Bilety nie zostały utworzone. Płatność wymaga ręcznej weryfikacji.",
    };
  }

  return {
    title: "Brak biletów",
    description: "Dla tego zamówienia nie wygenerowano jeszcze biletów.",
  };
}

/**
 * Customer order page. A review order must not say that tickets are being prepared.
 */
export function customerOrderTicketSection(
  status: PaymentStatus,
  ticketCount: number,
): CustomerTicketSection {
  if (status === "review") {
    return {
      kind: "review",
      heading: "Płatność wymaga weryfikacji",
      body: "Płatność wymaga ręcznej weryfikacji. Bilety nie zostały przygotowane. Napisz do obsługi i podaj numer zamówienia.",
      email: ORDER_SUPPORT_EMAIL,
      contactPath: "/kontakt",
    };
  }

  if (ticketCount === 0) {
    return {
      kind: "empty",
      message: "Bilety są w trakcie przygotowania. Odśwież stronę za chwilę.",
    };
  }

  return {
    kind: "tickets",
    intro: "Pokaż kod QR przy wejściu do ogrodu.",
  };
}
