import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateTicketsForOrder: vi.fn(),
  updateSoldCountForOrder: vi.fn(),
  sendOrderEmail: vi.fn(),
  sendInvoiceNotificationEmails: vi.fn(),
}));

vi.mock("@/lib/tickets", () => ({
  generateTicketsForOrder: mocks.generateTicketsForOrder,
}));

vi.mock("@/lib/sheets/update-sold-count", () => ({
  updateSoldCountForOrder: mocks.updateSoldCountForOrder,
}));

vi.mock("@/lib/email/send-order-email", () => ({
  sendOrderEmail: mocks.sendOrderEmail,
}));

vi.mock("@/lib/email/send-invoice-notification-emails", () => ({
  sendInvoiceNotificationEmails: mocks.sendInvoiceNotificationEmails,
}));

beforeEach(() => {
  mocks.generateTicketsForOrder.mockReset();
  mocks.updateSoldCountForOrder.mockReset();
  mocks.sendOrderEmail.mockReset();
  mocks.sendInvoiceNotificationEmails.mockReset();
});

test("does not confirm the order when ticket creation fails", async () => {
  mocks.generateTicketsForOrder.mockRejectedValue(new Error("ticket insert failed"));
  const { finalizePaidOrder } = await import("@/lib/payments/finalize-paid-order");

  await expect(finalizePaidOrder("order-1")).rejects.toThrow(/ticket insert failed/);
  expect(mocks.updateSoldCountForOrder).not.toHaveBeenCalled();
  expect(mocks.sendOrderEmail).not.toHaveBeenCalled();
  expect(mocks.sendInvoiceNotificationEmails).not.toHaveBeenCalled();
});
