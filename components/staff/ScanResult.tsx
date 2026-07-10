import type { ScanApiResult } from "@/lib/staff/scan-api";

type ScanResultProps = {
  loading: boolean;
  result: ScanApiResult | null;
};

function formatVisitDate(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
  }).format(new Date(`${value}T12:00:00`));
}

function formatUsedAt(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55">
      <div className="flex flex-col items-center gap-4">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        <p className="text-xl font-semibold text-white">Sprawdzanie biletu...</p>
      </div>
    </div>
  );
}

export function ScanResult({ loading, result }: ScanResultProps) {
  if (loading && !result) {
    return <LoadingOverlay />;
  }

  if (!result) {
    return null;
  }

  if (result.status === "VALID") {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-green-600 px-6 text-white">
        <div className="max-w-lg text-center">
          <div className="text-7xl font-bold sm:text-8xl">✓</div>
          <h2 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            ✓ BILET WAŻNY
          </h2>
          <p className="mt-4 text-2xl font-semibold sm:text-3xl">Entry allowed</p>
          <p className="mt-8 text-xl sm:text-2xl">
            Data wizyty: {formatVisitDate(result.visitDate)}
          </p>
          <p className="mt-4 break-all font-mono text-lg opacity-90 sm:text-xl">
            {result.ticketCode}
          </p>
        </div>
      </div>
    );
  }

  if (result.status === "USED") {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-red-700 px-6 text-white">
        <div className="max-w-lg text-center">
          <div className="text-7xl font-bold sm:text-8xl">!</div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
            BILET JUŻ WYKORZYSTANY
          </h2>
          <p className="mt-8 text-xl sm:text-2xl">
            Data wizyty: {formatVisitDate(result.visitDate)}
          </p>
          <p className="mt-4 text-xl sm:text-2xl">
            Wykorzystano: {formatUsedAt(result.usedAt)}
          </p>
          <p className="mt-4 break-all font-mono text-lg opacity-90 sm:text-xl">
            {result.ticketCode}
          </p>
        </div>
      </div>
    );
  }

  if (result.status === "CANCELLED") {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-gray-700 px-6 text-white">
        <div className="max-w-lg text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            BILET ANULOWANY
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-red-700 px-6 text-white">
      <div className="max-w-lg text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
          NIE ZNALEZIONO BILETU
        </h2>
      </div>
    </div>
  );
}
