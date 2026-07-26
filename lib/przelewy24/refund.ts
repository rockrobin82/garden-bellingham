import "server-only";

import type { P24Client } from "@/lib/przelewy24/client";
import type { P24Config } from "@/lib/przelewy24/config";
import { signRefundTransaction } from "@/lib/przelewy24/sign";
import {
  P24ApiError,
  type P24Currency,
  type RefundTransactionInput,
  type RefundTransactionRequest,
  type RefundTransactionResponseData,
  type RefundTransactionResult,
} from "@/lib/przelewy24/types";

/**
 * Requests a refund batch from Przelewy24.
 * Signature amount is the sum of all refund item amounts.
 */
export async function refundTransaction(
  client: P24Client,
  config: P24Config,
  input: RefundTransactionInput,
): Promise<RefundTransactionResult> {
  const currency: P24Currency = input.currency ?? "PLN";
  const amount = input.refunds.reduce((sum, item) => sum + item.amount, 0);

  const sign = signRefundTransaction({
    requestId: input.requestId,
    refundsUuid: input.refundsUuid,
    amount,
    currency,
    crc: config.crcKey,
  });

  const body: RefundTransactionRequest = {
    ...input,
    currency,
    sign,
  };

  const items = await client.post<RefundTransactionResponseData>(
    "/transaction/refund",
    body,
  );

  if (!Array.isArray(items) || items.length === 0) {
    throw new P24ApiError("Przelewy24 refund response is empty", {
      statusCode: 502,
    });
  }

  const rejected = items.find((item) => item.status !== true);
  if (rejected) {
    throw new P24ApiError(
      rejected.message ?? "Przelewy24 rejected the refund request",
      { statusCode: 502 },
    );
  }

  return {
    requestId: input.requestId,
    refundsUuid: input.refundsUuid,
    amount,
    currency,
    items,
  };
}
