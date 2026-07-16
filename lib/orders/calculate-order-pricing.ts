import "server-only";

export function plnToMinor(amountPln: number): number {
  return Math.round(amountPln * 100);
}

export type OrderPricingInput = {
  normalQty: number;
  reducedQty: number;
  priceNormalPln: number;
  priceReducedPln: number;
};

export type OrderPricingResult = {
  ticketQty: number;
  normalQty: number;
  reducedQty: number;
  unitPriceMinor: number;
  totalAmountMinor: number;
};

export function calculateOrderPricing(
  input: OrderPricingInput,
): OrderPricingResult {
  const ticketQty = input.normalQty + input.reducedQty;
  const totalAmountMinor =
    plnToMinor(input.priceNormalPln) * input.normalQty +
    plnToMinor(input.priceReducedPln) * input.reducedQty;
  const unitPriceMinor =
    ticketQty > 0 ? Math.round(totalAmountMinor / ticketQty) : 0;

  return {
    ticketQty,
    normalQty: input.normalQty,
    reducedQty: input.reducedQty,
    unitPriceMinor,
    totalAmountMinor,
  };
}
