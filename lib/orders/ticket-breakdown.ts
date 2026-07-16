import "server-only";

export type TicketBreakdown = {
  normalQty: number;
  reducedQty: number;
  totalQty: number;
};

export function getTicketBreakdown(order: {
  normal_qty: number;
  reduced_qty: number;
  ticket_qty: number;
}): TicketBreakdown {
  const hasStoredBreakdown = order.normal_qty > 0 || order.reduced_qty > 0;

  if (hasStoredBreakdown) {
    return {
      normalQty: order.normal_qty,
      reducedQty: order.reduced_qty,
      totalQty: order.ticket_qty,
    };
  }

  return {
    normalQty: order.ticket_qty,
    reducedQty: 0,
    totalQty: order.ticket_qty,
  };
}
