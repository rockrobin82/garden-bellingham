export const P24_REFUND_STATUS = {
  completed: 1,
  pending: 2,
  awaitingAcceptance: 3,
  rejected: 4,
} as const;

export type RefundRecoveryState =
  | "dispatching"
  | "unknown"
  | "submitted"
  | "pending_at_provider"
  | "rejected"
  | "accepted"
  | "manual_review";

export type RefundRecoveryRecord = {
  state: RefundRecoveryState;
  requestId: string;
  refundsUuid: string;
  p24OrderId: string;
  sessionId: string;
  amountMinor: number;
  reason: string;
  matchedBy?: "request" | "amount";
};

export type ProviderRefundSnapshot = {
  requestId: string;
  status: number;
  amount: number;
};

export type ProviderRefundLookup =
  | { outcome: "not_found" }
  | { outcome: "unavailable" }
  | { outcome: "listed"; refunds: readonly ProviderRefundSnapshot[] };

export type RefundPlan =
  | { action: "finalize"; record: RefundRecoveryRecord }
  | { action: "submit"; record: RefundRecoveryRecord }
  | { action: "wait"; record: RefundRecoveryRecord; persist: boolean };

export const REFUND_RECOVERY_STATE = {
  none: "none",
  dispatching: "dispatching",
  unknown: "unknown",
  submitted: "submitted",
  pendingAtProvider: "pending_at_provider",
  rejected: "rejected",
  accepted: "accepted",
  manualReview: "manual_review",
} as const;

export const REFUND_CLAIM_ANY_STATE = [
  REFUND_RECOVERY_STATE.none,
  REFUND_RECOVERY_STATE.dispatching,
  REFUND_RECOVERY_STATE.unknown,
  REFUND_RECOVERY_STATE.submitted,
  REFUND_RECOVERY_STATE.pendingAtProvider,
  REFUND_RECOVERY_STATE.rejected,
  REFUND_RECOVERY_STATE.accepted,
  REFUND_RECOVERY_STATE.manualReview,
] as const;

const RECOVERY_STATES = new Set<RefundRecoveryState>([
  "dispatching",
  "unknown",
  "submitted",
  "pending_at_provider",
  "rejected",
  "accepted",
  "manual_review",
]);

const KNOWN_STATUSES = new Set<number>([
  P24_REFUND_STATUS.completed,
  P24_REFUND_STATUS.pending,
  P24_REFUND_STATUS.awaitingAcceptance,
  P24_REFUND_STATUS.rejected,
]);

export function stableRefundRequestId(orderId: string): string {
  return `refund-${orderId}`;
}

/**
 * Decides whether to record a completed refund, send one request, or wait.
 * HTTP 404 authorizes a send only when local state shows that no earlier
 * attempt has left this process: there is no marker, the marker is still
 * `dispatching`, or the operator already rejected the attempt.
 * `unknown` and `submitted` stay put on 404, because that request may already
 * have been accepted even if the lookup cannot see it yet.
 */
export function planRefundFromLookup(input: {
  orderId: string;
  amountMinor: number;
  reason: string;
  p24OrderId: string;
  sessionId: string;
  stored: RefundRecoveryRecord | null;
  lookup: ProviderRefundLookup;
}): RefundPlan {
  const requestId = stableRefundRequestId(input.orderId);
  const record = (
    state: RefundRecoveryState,
    matchedBy?: RefundRecoveryRecord["matchedBy"],
  ): RefundRecoveryRecord => ({
    state,
    requestId,
    refundsUuid: input.orderId,
    p24OrderId: input.p24OrderId,
    sessionId: input.sessionId,
    amountMinor: input.amountMinor,
    reason: input.reason,
    ...(matchedBy ? { matchedBy } : {}),
  });
  const wait = (
    state: RefundRecoveryState,
    persist = true,
  ): RefundPlan => ({
    action: "wait",
    record: record(state),
    persist,
  });
  const storedAccepted = isStoredAcceptance(input.stored, requestId, input.amountMinor);

  if (input.lookup.outcome === "unavailable") {
    if (storedAccepted) {
      return { action: "finalize", record: record("accepted", "request") };
    }

    if (!input.stored) {
      return wait("unknown", false);
    }

    return wait(preservedWaitState(input.stored.state));
  }

  if (input.lookup.outcome === "not_found") {
    if (storedAccepted) {
      return { action: "finalize", record: record("accepted", "request") };
    }

    if (
      input.stored?.state === "pending_at_provider" ||
      input.stored?.state === "submitted" ||
      input.stored?.state === "unknown" ||
      input.stored?.state === "manual_review"
    ) {
      return wait(input.stored.state);
    }

    return { action: "submit", record: record("dispatching") };
  }

  if (input.lookup.refunds.length === 0) {
    if (!input.stored) {
      return wait("unknown", false);
    }

    return wait(storedAccepted ? "unknown" : preservedWaitState(input.stored.state));
  }

  const ours = input.lookup.refunds.filter((item) => item.requestId === requestId);
  const completed = ours.find(
    (item) =>
      item.status === P24_REFUND_STATUS.completed &&
      item.amount === input.amountMinor,
  );

  if (completed) {
    return { action: "finalize", record: record("accepted", "request") };
  }

  if (hasUnresolvedStatus(input.lookup.refunds)) {
    return wait("manual_review");
  }

  if (
    input.lookup.refunds.some(
      (item) =>
        item.status === P24_REFUND_STATUS.pending ||
        item.status === P24_REFUND_STATUS.awaitingAcceptance,
    )
  ) {
    return wait("pending_at_provider");
  }

  const completedTotal = completedRefundTotal(input.lookup.refunds);

  if (completedTotal > 0 && completedTotal === input.amountMinor) {
    return { action: "finalize", record: record("accepted", "amount") };
  }

  if (storedAccepted) {
    return wait("manual_review");
  }

  if (
    input.lookup.refunds.some(
      (item) => item.status === P24_REFUND_STATUS.completed,
    )
  ) {
    return wait("manual_review");
  }

  const rejected = ours.some((item) => item.status === P24_REFUND_STATUS.rejected);

  if (
    rejected &&
    (input.stored?.state === "unknown" ||
      input.stored?.state === "dispatching" ||
      input.stored?.state === "submitted" ||
      input.stored?.state === "pending_at_provider" ||
      input.stored?.state === "manual_review")
  ) {
    return wait("rejected");
  }

  return { action: "submit", record: record("dispatching") };
}

export function readRefundRecovery(metadata: unknown): RefundRecoveryRecord | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const recovery = (metadata as Record<string, unknown>).refund_recovery;

  if (!recovery || typeof recovery !== "object" || Array.isArray(recovery)) {
    return null;
  }

  const record = recovery as Record<string, unknown>;

  if (
    typeof record.state !== "string" ||
    !RECOVERY_STATES.has(record.state as RefundRecoveryState)
  ) {
    return null;
  }

  if (
    typeof record.requestId !== "string" ||
    record.requestId.length === 0 ||
    typeof record.refundsUuid !== "string" ||
    typeof record.p24OrderId !== "string" ||
    typeof record.sessionId !== "string" ||
    typeof record.reason !== "string" ||
    typeof record.amountMinor !== "number" ||
    !Number.isSafeInteger(record.amountMinor)
  ) {
    return null;
  }

  return {
    state: record.state as RefundRecoveryState,
    requestId: record.requestId,
    refundsUuid: record.refundsUuid,
    p24OrderId: record.p24OrderId,
    sessionId: record.sessionId,
    amountMinor: record.amountMinor,
    reason: record.reason,
    ...(record.matchedBy === "request" || record.matchedBy === "amount"
      ? { matchedBy: record.matchedBy }
      : {}),
  };
}

export function adminRefundRecoveryNote(
  record: RefundRecoveryRecord | null,
): string | null {
  if (!record || record.state === "accepted") {
    return null;
  }

  if (record.state === "rejected") {
    return "Przelewy24 odrzuciło poprzednie żądanie zwrotu. Miejsca i liczniki pozostały bez zmian.";
  }

  if (record.state === "manual_review") {
    return "W Przelewy24 jest zwrot, którego nie da się automatycznie uzgodnić z pełną kwotą zamówienia. Miejsca i liczniki pozostały bez zmian. Zwolnienie miejsc wymaga potwierdzonego zwrotu pełnej kwoty dla tej transakcji.";
  }

  if (record.state === "dispatching") {
    return `Zwrot został rozpoczęty, ale żądanie nie zostało jeszcze wysłane. Kolejne sprawdzenie może wysłać jedno żądanie, jeśli operator nie ma zapisanego zwrotu. Identyfikator żądania: ${record.requestId}`;
  }

  if (record.state === "submitted" || record.state === "pending_at_provider") {
    return `Operator przyjął zwrot, ale jego zakończenie nie jest jeszcze potwierdzone. Nowy zwrot nie zostanie wysłany. Identyfikator żądania: ${record.requestId}`;
  }

  return `Wynik wysłanego zwrotu nie jest znany. Kolejne sprawdzenie odczyta status i nie wyśle nowego zwrotu. Identyfikator żądania: ${record.requestId}`;
}

function preservedWaitState(state: RefundRecoveryState): RefundRecoveryState {
  return state;
}

function hasUnresolvedStatus(refunds: readonly ProviderRefundSnapshot[]): boolean {
  return refunds.some((item) => !KNOWN_STATUSES.has(item.status));
}

function completedRefundTotal(refunds: readonly ProviderRefundSnapshot[]): number {
  return refunds.reduce((sum, item) => {
    if (item.status !== P24_REFUND_STATUS.completed || !Number.isSafeInteger(item.amount)) {
      return sum;
    }

    return sum + item.amount;
  }, 0);
}

function isStoredAcceptance(
  stored: RefundRecoveryRecord | null,
  requestId: string,
  amountMinor: number,
): boolean {
  return (
    stored?.state === "accepted" &&
    stored.requestId === requestId &&
    stored.amountMinor === amountMinor
  );
}
