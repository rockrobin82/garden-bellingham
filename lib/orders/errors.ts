export class OrderRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OrderRequestError";
    this.status = status;
  }
}

export class BookingDateNotFoundError extends OrderRequestError {
  constructor(bookingDate: string) {
    super(`Booking date not found: ${bookingDate}`, 404);
    this.name = "BookingDateNotFoundError";
  }
}

export class BookingDateInactiveError extends OrderRequestError {
  constructor(bookingDate: string) {
    super(`Booking date is not available: ${bookingDate}`, 409);
    this.name = "BookingDateInactiveError";
  }
}

export class InsufficientTicketsError extends OrderRequestError {
  constructor(remaining: number) {
    super(`Not enough tickets available. Remaining: ${remaining}`, 409);
    this.name = "InsufficientTicketsError";
  }
}
