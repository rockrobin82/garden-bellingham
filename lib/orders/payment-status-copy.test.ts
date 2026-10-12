import { expect, test } from "vitest";

import { formatPaymentStatus } from "@/lib/orders/format-payment-status";
import {
  ORDER_SUPPORT_EMAIL,
  adminPaymentStatusDescription,
  adminTicketsEmptyCopy,
  customerOrderTicketSection,
} from "@/lib/orders/payment-status-copy";

test("review is distinct from pending, paid, and refunded", () => {
  const labels = ["pending", "paid", "review", "refunded"].map((status) =>
    formatPaymentStatus(status as "pending"),
  );
  const descriptions = ["pending", "paid", "review", "refunded"].map((status) =>
    adminPaymentStatusDescription(status as "pending"),
  );

  expect(new Set(labels).size).toBe(4);
  expect(new Set(descriptions).size).toBe(4);
  expect(formatPaymentStatus("review")).toBe("Wymaga weryfikacji");
  expect(adminPaymentStatusDescription("review")).toMatch(/ręcznej weryfikacji/);
  expect(adminPaymentStatusDescription("review")).not.toMatch(/HOLD_|rpc/i);
});

test("a review order does not say tickets are being prepared", () => {
  const withoutTickets = customerOrderTicketSection("review", 0);
  const withTickets = customerOrderTicketSection("review", 2);

  expect(withoutTickets).toMatchObject({
    kind: "review",
    email: ORDER_SUPPORT_EMAIL,
    contactPath: "/kontakt",
  });
  expect(withTickets.kind).toBe("review");

  for (const section of [withoutTickets, withTickets]) {
    expect(JSON.stringify(section)).not.toMatch(/przygotowania|wkrótce|sukces/i);
    expect(JSON.stringify(section)).not.toMatch(/HOLD_|postgres|rpc/i);
  }

  expect(adminTicketsEmptyCopy("review").description).not.toMatch(/jeszcze|przygotowania/);
  expect(customerOrderTicketSection("paid", 0)).toMatchObject({
    kind: "empty",
    message: "Bilety są w trakcie przygotowania. Odśwież stronę za chwilę.",
  });
});
