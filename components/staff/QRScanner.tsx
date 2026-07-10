"use client";

import { Scanner } from "@yudiel/react-qr-scanner";

type QRScannerProps = {
  paused: boolean;
  onDetect: (ticketCode: string) => void;
  onCameraError: (message: string) => void;
};

export function QRScanner({ paused, onDetect, onCameraError }: QRScannerProps) {
  return (
    <div className="absolute inset-0">
      <Scanner
        paused={paused}
        sound={false}
        allowMultiple={false}
        scanDelay={300}
        constraints={{
          facingMode: { ideal: "environment" },
        }}
        formats={["qr_code"]}
        onScan={(detectedCodes) => {
          const ticketCode = detectedCodes[0]?.rawValue?.trim();

          if (ticketCode) {
            onDetect(ticketCode);
          }
        }}
        onError={(error) => {
          if (error.kind === "permission-denied") {
            onCameraError("Kamera jest wymagana do skanowania biletów.");
            return;
          }

          onCameraError(
            error.message || "Nie udało się uruchomić kamery. Spróbuj ponownie.",
          );
        }}
        styles={{
          container: {
            width: "100%",
            height: "100%",
          },
          video: {
            width: "100%",
            height: "100%",
            objectFit: "cover",
          },
        }}
      />
    </div>
  );
}
