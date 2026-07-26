/**
 * Przelewy24 REST API v1 request/response types.
 */

export type P24Currency = "PLN" | "EUR" | "USD" | "GBP" | "CZK";

export type P24ApiResponse<T> = {
  data: T;
  responseCode: number;
};

export type RegisterTransactionInput = {
  sessionId: string;
  amount: number;
  currency: P24Currency;
  description: string;
  email: string;
  urlReturn: string;
  urlStatus: string;
  country?: string;
  language?: string;
  timeLimit?: number;
  encoding?: string;
  client?: string;
  channel?: number;
  method?: number;
  regulationAccept?: boolean;
  waitForResult?: boolean;
  transferLabel?: string;
  methodRefId?: string;
  shipping?: number;
  cart?: ReadonlyArray<{
    name: string;
    description?: string;
    quantity: number;
    price: number;
    number?: number;
  }>;
};

export type RegisterTransactionRequest = RegisterTransactionInput & {
  merchantId: number;
  posId: number;
  sign: string;
};

export type RegisterTransactionResponseData = {
  token: string;
};

export type RegisterTransactionResult = {
  token: string;
  redirectUrl: string;
};

export type VerifyTransactionInput = {
  sessionId: string;
  orderId: number;
  amount: number;
  currency: P24Currency;
};

export type VerifyTransactionRequest = VerifyTransactionInput & {
  merchantId: number;
  posId: number;
  sign: string;
};

export type VerifyTransactionResponseData = {
  status: string;
};

export type VerifyTransactionResult = {
  status: string;
};

export type RegisterTransactionSignParams = {
  sessionId: string;
  merchantId: number;
  amount: number;
  currency: string;
  crc: string;
};

export type VerifyTransactionSignParams = {
  sessionId: string;
  orderId: number;
  amount: number;
  currency: string;
  crc: string;
};

export type TransactionNotificationSignParams = {
  merchantId: number;
  posId: number;
  sessionId: string;
  amount: number;
  originAmount: number;
  currency: string;
  orderId: number;
  methodId: number;
  statement: string;
  crc: string;
};

export type TransactionNotificationPayload = {
  merchantId: number;
  posId: number;
  sessionId: string;
  amount: number;
  originAmount: number;
  currency: P24Currency;
  orderId: number;
  methodId: number;
  statement: string;
  sign: string;
};

export type RefundNotificationSignParams = {
  orderId: number;
  sessionId: string;
  refundsUuid: string;
  merchantId: number;
  amount: number;
  currency: string;
  status: number;
  crc: string;
};

export type RefundTransactionSignParams = {
  requestId: string;
  refundsUuid: string;
  amount: number;
  currency: string;
  crc: string;
};

export type RefundTransactionItemInput = {
  orderId: number;
  sessionId: string;
  amount: number;
  description: string;
};

export type RefundTransactionInput = {
  requestId: string;
  refundsUuid: string;
  refunds: ReadonlyArray<RefundTransactionItemInput>;
  currency?: P24Currency;
  urlStatus?: string;
};

export type RefundTransactionRequest = RefundTransactionInput & {
  sign: string;
};

export type RefundTransactionResponseItem = {
  orderId: number;
  sessionId: string;
  status: boolean;
  message?: string;
};

export type RefundTransactionResponseData =
  ReadonlyArray<RefundTransactionResponseItem>;

export type RefundTransactionResult = {
  requestId: string;
  refundsUuid: string;
  amount: number;
  currency: P24Currency;
  items: RefundTransactionResponseData;
};

export class P24ApiError extends Error {
  readonly statusCode: number;
  readonly responseCode?: number;

  constructor(
    message: string,
    options: { statusCode: number; responseCode?: number },
  ) {
    super(message);
    this.name = "P24ApiError";
    this.statusCode = options.statusCode;
    this.responseCode = options.responseCode;
  }
}

export class P24NetworkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "P24NetworkError";
  }
}
