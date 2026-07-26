import { createHash } from "crypto";

import type {
  RefundNotificationSignParams,
  RefundTransactionSignParams,
  RegisterTransactionSignParams,
  TransactionNotificationSignParams,
  VerifyTransactionSignParams,
} from "@/lib/przelewy24/types";

/**
 * Computes a Przelewy24 SHA-384 signature over a JSON payload.
 * Field insertion order is load-bearing and must match P24 documentation.
 */
export function signSha384(
  payload: Record<string, string | number | boolean>,
): string {
  return createHash("sha384").update(JSON.stringify(payload)).digest("hex");
}

/** Signature for `POST /transaction/register`. */
export function signRegisterTransaction(
  params: RegisterTransactionSignParams,
): string {
  return signSha384({
    sessionId: params.sessionId,
    merchantId: params.merchantId,
    amount: params.amount,
    currency: params.currency,
    crc: params.crc,
  });
}

/** Signature for `PUT /transaction/verify`. */
export function signVerifyTransaction(params: VerifyTransactionSignParams): string {
  return signSha384({
    sessionId: params.sessionId,
    orderId: params.orderId,
    amount: params.amount,
    currency: params.currency,
    crc: params.crc,
  });
}

/** Signature for transaction notifications posted to `urlStatus`. */
export function signTransactionNotification(
  params: TransactionNotificationSignParams,
): string {
  return signSha384({
    merchantId: params.merchantId,
    posId: params.posId,
    sessionId: params.sessionId,
    amount: params.amount,
    originAmount: params.originAmount,
    currency: params.currency,
    orderId: params.orderId,
    methodId: params.methodId,
    statement: params.statement,
    crc: params.crc,
  });
}

/** Signature for `POST /transaction/refund`. */
export function signRefundTransaction(
  params: RefundTransactionSignParams,
): string {
  return signSha384({
    requestId: params.requestId,
    refundsUuid: params.refundsUuid,
    amount: params.amount,
    currency: params.currency,
    crc: params.crc,
  });
}

/** Signature for refund notifications posted to `urlStatus`. */
export function signRefundNotification(
  params: RefundNotificationSignParams,
): string {
  return signSha384({
    orderId: params.orderId,
    sessionId: params.sessionId,
    refundsUuid: params.refundsUuid,
    merchantId: params.merchantId,
    amount: params.amount,
    currency: params.currency,
    status: params.status,
    crc: params.crc,
  });
}
