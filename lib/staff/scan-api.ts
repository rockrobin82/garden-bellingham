export type ScanApiValidResult = {
  status: "VALID";
  ticketCode: string;
  visitDate: string;
};

export type ScanApiUsedResult = {
  status: "USED";
  ticketCode: string;
  visitDate: string;
  usedAt: string;
};

export type ScanApiCancelledResult = {
  status: "CANCELLED";
};

export type ScanApiNotFoundResult = {
  status: "NOT_FOUND";
};

export type ScanApiResult =
  | ScanApiValidResult
  | ScanApiUsedResult
  | ScanApiCancelledResult
  | ScanApiNotFoundResult;

export async function postScanTicket(
  ticketCode: string,
): Promise<ScanApiResult> {
  const response = await fetch("/api/tickets/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticketCode }),
    cache: "no-store",
  });

  const data = (await response.json()) as ScanApiResult | { error?: string };

  if ("status" in data) {
    return data;
  }

  throw new Error(data.error ?? "Scan request failed");
}
