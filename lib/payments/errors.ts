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

export class OrderAlreadyRefundedError extends PaymentRequestError {
  constructor(orderId: string) {
    super(`Order already refunded: ${orderId}`, 409);
    this.name = "OrderAlreadyRefundedError";
  }
}

export class OrderNotRefundableError extends PaymentRequestError {
  constructor(orderId: string) {
    super(`Order is not refundable: ${orderId}`, 409);
    this.name = "OrderNotRefundableError";
  }
}

export class OrderMissingPaymentDataError extends PaymentRequestError {
  constructor(orderId: string) {
    super(`Order is missing Przelewy24 payment data: ${orderId}`, 422);
    this.name = "OrderMissingPaymentDataError";
  }
}

export class RefundOutcomeUnknownError extends PaymentRequestError {
  constructor() {
    super(
      "Wynik zwrotu w Przelewy24 nie jest potwierdzony. Ponowienie sprawdzi status i nie wyśle drugiego zwrotu, dopóki wynik jest nieznany.",
      409,
    );
    this.name = "RefundOutcomeUnknownError";
  }
}

export class RefundRejectedError extends PaymentRequestError {
  constructor() {
    super(
      "Przelewy24 odrzuciło zwrot. Miejsca i liczniki pozostały bez zmian.",
      409,
    );
    this.name = "RefundRejectedError";
  }
}

export class RefundInProgressError extends PaymentRequestError {
  constructor() {
    super("Zwrot tego zamówienia jest już przetwarzany.", 409);
    this.name = "RefundInProgressError";
  }
}
