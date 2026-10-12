import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  OrderAlreadyRefundedError,
  OrderMissingPaymentDataError,
  OrderNotFoundError,
  OrderNotRefundableError,
  RefundInProgressError,
  RefundOutcomeUnknownError,
  RefundRejectedError,
} from "@/lib/payments/errors";
import {
  planRefundFromLookup,
  readRefundRecovery,
  REFUND_CLAIM_ANY_STATE,
  REFUND_RECOVERY_STATE,
  type ProviderRefundLookup,
  type RefundRecoveryRecord,
} from "@/lib/payments/refund-recovery";
import {
  createP24Client,
  getP24Config,
  getRefundsByOrderId,
  P24RefundRejectedError,
  refundTransaction,
  type RefundTransactionResult,
} from "@/lib/przelewy24";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, PaymentStatus } from "@/types/database";

const LOG_PREFIX = "[refundP24Payment]";

const DEFAULT_REFUND_REASON = "Zwrot wykonany przez administratora";

type AdminClient = SupabaseClient<Database>;

type OrderForRefund = {
  id: string;
  booking_date: string;
  customer_email: string;
  ticket_qty: number;
  total_amount_minor: number;
  payment_status: PaymentStatus;
  p24_session_id: string | null;
  p24_order_id: string | null;
  payment_metadata: Record<string, unknown> | null;
};

export type RefundP24PaymentResult = {
  orderId: string;
  refundId: string;
  refundAmountMinor: number;
  refundReason: string;
  refundedAt: string;
  p24: RefundTransactionResult;
};

export type RefundClaimResult = {
  claimed: boolean;
  paymentStatus: string;
  metadata: Record<string, unknown>;
};

export type RefundP24Dependencies = {
  supabase?: AdminClient;
  loadOrder?: (orderId: string) => Promise<OrderForRefund>;
  claimRecovery?: (
    orderId: string,
    record: RefundRecoveryRecord,
    expectedStates: readonly string[],
  ) => Promise<RefundClaimResult>;
  lookupRefunds?: (p24OrderId: number) => Promise<ProviderRefundLookup>;
  submitRefund?: (input: {
    requestId: string;
    refundsUuid: string;
    orderId: number;
    sessionId: string;
    amount: number;
    description: string;
  }) => Promise<RefundTransactionResult>;
};

function isRefundableStatus(status: string): boolean {
  return status === "paid" || status === "completed" || status === "review";
}

/**
 * Asks Przelewy24 for a refund, then returns only after the refund lookup
 * shows status 1 (completed) for the stable request id.
 * Payment status, tickets, and seat counters stay unchanged here.
 * A timeout or an unfinished lookup throws RefundOutcomeUnknownError and
 * does not send another refund in the same call.
 */
export async function refundP24Payment(
  orderId: string,
  reason?: string,
  dependencies: RefundP24Dependencies = {},
): Promise<RefundP24PaymentResult> {
  const supabase = () => dependencies.supabase ?? getSupabaseAdminClient();
  const loadOrder =
    dependencies.loadOrder ?? ((id: string) => loadRefundOrder(supabase(), id));
  const claimRecovery =
    dependencies.claimRecovery ??
    ((id: string, record: RefundRecoveryRecord, expectedStates: readonly string[]) =>
      claimOrderRefund(supabase(), id, record, expectedStates));
  const lookupRefunds = dependencies.lookupRefunds ?? lookupProviderRefunds;
  const submitRefund = dependencies.submitRefund ?? submitProviderRefund;
  const order = await loadOrder(orderId);
  const refundReason = normalizeReason(reason);

  assertRefundable(order);

  const p24OrderId = Number(order.p24_order_id);
  const sessionId = order.p24_session_id ?? order.id;
  let metadata = readMetadata(order.payment_metadata);

  const claim = async (
    record: RefundRecoveryRecord,
    expectedStates: readonly string[],
  ): Promise<boolean> => {
    const result = await claimRecovery(order.id, record, expectedStates);
    metadata = result.metadata;

    if (result.paymentStatus === "refunded") {
      throw new OrderAlreadyRefundedError(order.id);
    }

    return result.claimed;
  };

  const resumeIfAccepted = (): RefundP24PaymentResult | null => {
    const current = readRefundRecovery(metadata);

    if (
      current?.state === "accepted" &&
      current.amountMinor === order.total_amount_minor
    ) {
      return refundResult(order.id, current, current.reason || refundReason);
    }

    return null;
  };

  const lookup = await readLookup(lookupRefunds, p24OrderId);
  const stored = readRefundRecovery(metadata);
  const plan = planRefundFromLookup({
    orderId: order.id,
    amountMinor: order.total_amount_minor,
    reason: refundReason,
    p24OrderId: String(p24OrderId),
    sessionId,
    stored,
    lookup,
  });

  if (plan.action === "finalize") {
    await claim(plan.record, REFUND_CLAIM_ANY_STATE);
    return refundResult(order.id, plan.record, refundReason);
  }

  if (plan.action === "wait") {
    if (plan.persist) {
      const expected = stored
        ? [stored.state]
        : [REFUND_RECOVERY_STATE.none];
      const claimed = await claim(plan.record, expected);

      if (!claimed) {
        const resumed = resumeIfAccepted();

        if (resumed) {
          return resumed;
        }

        throw new RefundInProgressError();
      }
    }

    if (plan.record.state === "rejected") {
      throw new RefundRejectedError();
    }

    throw new RefundOutcomeUnknownError();
  }

  const armed = await armProviderSend(claim, plan.record, stored, () =>
    readRefundRecovery(metadata),
  );

  if (armed === "accepted") {
    const resumed = resumeIfAccepted();

    if (resumed) {
      return resumed;
    }

    throw new RefundInProgressError();
  }

  try {
    await submitRefund({
      requestId: plan.record.requestId,
      refundsUuid: plan.record.refundsUuid,
      orderId: p24OrderId,
      sessionId,
      amount: order.total_amount_minor,
      description: refundReason,
    });
  } catch (error) {
    if (error instanceof P24RefundRejectedError) {
      console.error(`${LOG_PREFIX} Przelewy24 rejected the refund.`, error);
      await claim(
        { ...plan.record, state: "rejected" },
        [REFUND_RECOVERY_STATE.unknown],
      );
      throw new RefundRejectedError();
    }

    console.error(`${LOG_PREFIX} Przelewy24 refund result is unknown.`, error);
    throw new RefundOutcomeUnknownError();
  }

  const confirmation = await readLookup(lookupRefunds, p24OrderId);
  const confirmed = planRefundFromLookup({
    orderId: order.id,
    amountMinor: order.total_amount_minor,
    reason: refundReason,
    p24OrderId: String(p24OrderId),
    sessionId,
    stored: { ...plan.record, state: "unknown" },
    lookup: confirmation,
  });

  if (confirmed.action === "finalize") {
    await claim(confirmed.record, REFUND_CLAIM_ANY_STATE);
    return refundResult(order.id, confirmed.record, refundReason);
  }

  const nextRecord =
    confirmed.action === "wait" && confirmed.record.state !== "unknown"
      ? confirmed.record
      : { ...plan.record, state: "submitted" as const };
  const claimed = await claim(nextRecord, [REFUND_RECOVERY_STATE.unknown]);

  if (!claimed) {
    const resumed = resumeIfAccepted();

    if (resumed) {
      return resumed;
    }

    throw new RefundInProgressError();
  }

  if (nextRecord.state === "rejected") {
    throw new RefundRejectedError();
  }

  throw new RefundOutcomeUnknownError();
}

async function armProviderSend(
  claim: (
    record: RefundRecoveryRecord,
    expectedStates: readonly string[],
  ) => Promise<boolean>,
  record: RefundRecoveryRecord,
  stored: RefundRecoveryRecord | null,
  currentRecovery: () => RefundRecoveryRecord | null,
): Promise<"armed" | "accepted"> {
  if (stored?.state !== "dispatching") {
    const expected =
      stored?.state === "rejected"
        ? [REFUND_RECOVERY_STATE.rejected]
        : [REFUND_RECOVERY_STATE.none];
    const claimed = await claim(
      { ...record, state: "dispatching" },
      expected,
    );

    if (!claimed) {
      if (currentRecovery()?.state === "accepted") {
        return "accepted";
      }

      throw new RefundInProgressError();
    }
  }

  const armed = await claim(
    { ...record, state: "unknown" },
    [REFUND_RECOVERY_STATE.dispatching],
  );

  if (!armed) {
    if (currentRecovery()?.state === "accepted") {
      return "accepted";
    }

    throw new RefundInProgressError();
  }

  return "armed";
}

function assertRefundable(order: OrderForRefund): void {
  if (order.payment_status === "refunded") {
    throw new OrderAlreadyRefundedError(order.id);
  }

  if (!isRefundableStatus(order.payment_status)) {
    throw new OrderNotRefundableError(order.id);
  }

  if (!order.p24_order_id) {
    throw new OrderMissingPaymentDataError(order.id);
  }

  const p24OrderId = Number(order.p24_order_id);

  if (!Number.isSafeInteger(p24OrderId) || p24OrderId <= 0) {
    throw new OrderMissingPaymentDataError(order.id);
  }
}

async function loadRefundOrder(
  supabase: AdminClient,
  orderId: string,
): Promise<OrderForRefund> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, booking_date, customer_email, ticket_qty, total_amount_minor, payment_status, p24_session_id, p24_order_id, payment_metadata",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error(`${LOG_PREFIX} Supabase load failed.`, error);
    throw new Error("Refund could not be started");
  }

  if (!data) {
    throw new OrderNotFoundError(orderId);
  }

  return {
    ...data,
    payment_metadata: readMetadata(data.payment_metadata),
  };
}

async function claimOrderRefund(
  supabase: AdminClient,
  orderId: string,
  record: RefundRecoveryRecord,
  expectedStates: readonly string[],
): Promise<RefundClaimResult> {
  const { data, error } = await supabase.rpc("claim_order_refund", {
    p_order_id: orderId,
    p_recovery: { ...record },
    p_expected_states: [...expectedStates],
  });

  if (error) {
    console.error(`${LOG_PREFIX} Refund claim failed.`, error);

    if (error.message.includes("ORDER_NOT_FOUND")) {
      throw new OrderNotFoundError(orderId);
    }

    throw new Error("Refund could not be started");
  }

  if (!data || typeof data !== "object" || !("claimed" in data)) {
    throw new Error("Refund could not be started");
  }

  const payload = data as {
    claimed?: boolean;
    payment_status?: string;
    payment_metadata?: unknown;
  };

  if (typeof payload.claimed !== "boolean") {
    throw new Error("Refund could not be started");
  }

  return {
    claimed: payload.claimed,
    paymentStatus: payload.payment_status ?? "",
    metadata: readMetadata(payload.payment_metadata),
  };
}

async function lookupProviderRefunds(
  p24OrderId: number,
): Promise<ProviderRefundLookup> {
  const config = getP24Config();
  const client = createP24Client(config);
  return getRefundsByOrderId(client, p24OrderId);
}

async function submitProviderRefund(input: {
  requestId: string;
  refundsUuid: string;
  orderId: number;
  sessionId: string;
  amount: number;
  description: string;
}): Promise<RefundTransactionResult> {
  const config = getP24Config();
  const client = createP24Client(config);

  return refundTransaction(client, config, {
    requestId: input.requestId,
    refundsUuid: input.refundsUuid,
    refunds: [
      {
        orderId: input.orderId,
        sessionId: input.sessionId,
        amount: input.amount,
        description: input.description,
      },
    ],
    currency: "PLN",
  });
}

async function readLookup(
  lookupRefunds: (p24OrderId: number) => Promise<ProviderRefundLookup>,
  p24OrderId: number,
): Promise<ProviderRefundLookup> {
  try {
    return await lookupRefunds(p24OrderId);
  } catch (error) {
    console.error(`${LOG_PREFIX} Refund lookup failed.`, error);
    return { outcome: "unavailable" };
  }
}

function refundResult(
  orderId: string,
  record: RefundRecoveryRecord,
  refundReason: string,
): RefundP24PaymentResult {
  return {
    orderId,
    refundId: record.refundsUuid,
    refundAmountMinor: record.amountMinor,
    refundReason,
    refundedAt: new Date().toISOString(),
    p24: {
      requestId: record.requestId,
      refundsUuid: record.refundsUuid,
      amount: record.amountMinor,
      currency: "PLN",
      items: [],
    },
  };
}

function normalizeReason(reason: string | undefined): string {
  if (reason?.trim() && reason.trim().length > 0) {
    return reason.trim();
  }

  return DEFAULT_REFUND_REASON;
}

function readMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}
