import "server-only";

import type { P24Client } from "@/lib/przelewy24/client";
import type { P24Config } from "@/lib/przelewy24/config";
import { signVerifyTransaction } from "@/lib/przelewy24/sign";
import type {
  VerifyTransactionInput,
  VerifyTransactionRequest,
  VerifyTransactionResponseData,
  VerifyTransactionResult,
} from "@/lib/przelewy24/types";

/**
 * Confirms a transaction with Przelewy24 after payment notification.
 */
export async function verifyTransaction(
  client: P24Client,
  config: P24Config,
  input: VerifyTransactionInput,
): Promise<VerifyTransactionResult> {
  const sign = signVerifyTransaction({
    sessionId: input.sessionId,
    orderId: input.orderId,
    amount: input.amount,
    currency: input.currency,
    crc: config.crcKey,
  });

  const body: VerifyTransactionRequest = {
    merchantId: config.merchantId,
    posId: config.posId,
    sessionId: input.sessionId,
    orderId: input.orderId,
    amount: input.amount,
    currency: input.currency,
    sign,
  };

  const data = await client.put<VerifyTransactionResponseData>(
    "/transaction/verify",
    body,
  );

  return {
    status: data.status,
  };
}
