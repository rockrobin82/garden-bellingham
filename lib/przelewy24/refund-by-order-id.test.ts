import { expect, test } from "vitest";

import { P24Client } from "@/lib/przelewy24/client";
import { getRefundsByOrderId } from "@/lib/przelewy24/refund-by-order-id";

test("reads the documented refund lookup without calling Przelewy24", async () => {
  const seen: string[] = [];
  const client = new P24Client({
    apiUrl: "http://127.0.0.1:9/api/v1",
    posId: 1,
    apiKey: "local-test-key",
    fetch: async (url) => {
      seen.push(String(url));
      return new Response(
        JSON.stringify({
          responseCode: 0,
          data: {
            orderId: 424242,
            sessionId: "session",
            amount: 6000,
            currency: "PLN",
            refunds: [
              {
                batchId: 7,
                requestId: "refund-order",
                date: "2026-10-11",
                login: "cashier",
                description: "Zwrot",
                status: 1,
                amount: 6000,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  await expect(getRefundsByOrderId(client, 424242)).resolves.toEqual({
    outcome: "listed",
    refunds: [{ requestId: "refund-order", status: 1, amount: 6000 }],
  });
  expect(seen).toEqual(["http://127.0.0.1:9/api/v1/refund/by/orderId/424242"]);
});

test("treats HTTP 404 as no registered refund and other failures as unknown", async () => {
  const notFound = new P24Client({
    apiUrl: "http://127.0.0.1:9/api/v1",
    posId: 1,
    apiKey: "local-test-key",
    fetch: async () =>
      new Response(JSON.stringify({ error: "Transaction not found", responseCode: 0 }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
  });
  const unavailable = new P24Client({
    apiUrl: "http://127.0.0.1:9/api/v1",
    posId: 1,
    apiKey: "local-test-key",
    fetch: async () => {
      throw new Error("timeout");
    },
  });

  await expect(getRefundsByOrderId(notFound, 424242)).resolves.toEqual({
    outcome: "not_found",
  });
  await expect(getRefundsByOrderId(unavailable, 424242)).resolves.toEqual({
    outcome: "unavailable",
  });
});
