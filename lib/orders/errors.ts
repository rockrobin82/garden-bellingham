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

export class EntrySlotNotFoundError extends OrderRequestError {
  constructor() {
    super("Entry slot not found", 404);
    this.name = "EntrySlotNotFoundError";
  }
}

export class EntrySlotInactiveError extends OrderRequestError {
  constructor() {
    super("Entry slot is not available", 409);
    this.name = "EntrySlotInactiveError";
  }
}

export class EntrySlotDateMismatchError extends OrderRequestError {
  constructor() {
    super("Entry slot does not match the booking date", 409);
    this.name = "EntrySlotDateMismatchError";
  }
}

export class EntrySlotCapacityError extends OrderRequestError {
  constructor() {
    super("Not enough tickets available", 409);
    this.name = "EntrySlotCapacityError";
  }
}

export class EntrySlotHoldConflictError extends OrderRequestError {
  constructor() {
    super("This order conflicts with an existing reservation", 409);
    this.name = "EntrySlotHoldConflictError";
  }
}

export class EntrySlotHoldInactiveError extends OrderRequestError {
  constructor() {
    super("Entry slot reservation is no longer active", 409);
    this.name = "EntrySlotHoldInactiveError";
  }
}

export class EntrySlotLimitError extends OrderRequestError {
  constructor() {
    super("Entry slot limit cannot be applied", 409);
    this.name = "EntrySlotLimitError";
  }
}

export class EntrySlotQuantityError extends OrderRequestError {
  constructor(message = "At least one ticket is required") {
    super(message, 400);
    this.name = "EntrySlotQuantityError";
  }
}

export class EntrySlotOrderLimitError extends OrderRequestError {
  constructor() {
    super("Too many tickets for one order", 409);
    this.name = "EntrySlotOrderLimitError";
  }
}

export class EntrySlotSheetError extends OrderRequestError {
  constructor() {
    super("Ticket availability could not be loaded", 503);
    this.name = "EntrySlotSheetError";
  }
}

export class EntrySlotUnavailableError extends OrderRequestError {
  constructor() {
    super("Ordering is temporarily unavailable", 503);
    this.name = "EntrySlotUnavailableError";
  }
}
