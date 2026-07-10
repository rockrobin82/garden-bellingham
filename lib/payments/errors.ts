export class PaymentRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PaymentRequestError";
    this.status = status;
  }
}

export class OrderNotFoundError extends PaymentRequestError {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`, 404);
    this.name = "OrderNotFoundError";
  }
}

export class OrderNotPayableError extends PaymentRequestError {
  constructor(orderId: string) {
    super(`Order is not payable: ${orderId}`, 409);
    this.name = "OrderNotPayableError";
  }
}

export class InvalidNotificationSignatureError extends PaymentRequestError {
  constructor() {
    super("Invalid notification signature", 400);
    this.name = "InvalidNotificationSignatureError";
  }
}

export class PaymentAmountMismatchError extends PaymentRequestError {
  constructor() {
    super("Notification amount does not match order", 400);
    this.name = "PaymentAmountMismatchError";
  }
}
