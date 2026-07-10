import "server-only";

import type { P24Client } from "@/lib/przelewy24/client";
import type { P24Config } from "@/lib/przelewy24/config";
import { signRegisterTransaction } from "@/lib/przelewy24/sign";
import type {
  RegisterTransactionInput,
  RegisterTransactionRequest,
  RegisterTransactionResponseData,
  RegisterTransactionResult,
} from "@/lib/przelewy24/types";

/**
 * Registers a transaction with Przelewy24 and returns the payment token.
 */
export async function registerTransaction(
  client: P24Client,
  config: P24Config,
  input: RegisterTransactionInput,
): Promise<RegisterTransactionResult> {
  const sign = signRegisterTransaction({
    sessionId: input.sessionId,
    merchantId: config.merchantId,
    amount: input.amount,
    currency: input.currency,
    crc: config.crcKey,
  });

  const body: RegisterTransactionRequest = {
    ...input,
    merchantId: config.merchantId,
    posId: config.posId,
    sign,
  };

  const data = await client.post<RegisterTransactionResponseData>(
    "/transaction/register",
    body,
  );

  return {
    token: data.token,
    redirectUrl: `${config.trnRequestBaseUrl}/trnRequest/${data.token}`,
  };
}
