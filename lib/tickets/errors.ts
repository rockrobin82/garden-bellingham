export class TicketRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "TicketRequestError";
    this.status = status;
  }
}

export class TicketNotFoundError extends TicketRequestError {
  constructor(ticketCode: string) {
    super(`Ticket not found: ${ticketCode}`, 404);
    this.name = "TicketNotFoundError";
  }
}

export class TicketCancelledError extends TicketRequestError {
  constructor(ticketCode: string) {
    super(`Ticket is cancelled: ${ticketCode}`, 409);
    this.name = "TicketCancelledError";
  }
}

export class TicketAlreadyUsedError extends TicketRequestError {
  constructor(ticketCode: string) {
    super(`Ticket already used: ${ticketCode}`, 409);
    this.name = "TicketAlreadyUsedError";
  }
}
