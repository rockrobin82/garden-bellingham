"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { QRScanner } from "@/components/staff/QRScanner";
import { ScanOverlay } from "@/components/staff/ScanOverlay";
import { ScanResult } from "@/components/staff/ScanResult";
import { postScanTicket, type ScanApiResult } from "@/lib/staff/scan-api";
import {
  playErrorBeep,
  playSuccessBeep,
  vibrateError,
  vibrateSuccess,
} from "@/lib/staff/scan-feedback";

export default function StaffScanPage() {
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanApiResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerKey, setScannerKey] = useState(0);
  const processingRef = useRef(false);

  const resumeScanning = useCallback(() => {
    setResult(null);
    setPaused(false);
    processingRef.current = false;
  }, []);

  useEffect(() => {
    if (!result) {
      return;
    }

    const delay = result.status === "VALID" ? 2000 : 3000;
    const timer = window.setTimeout(resumeScanning, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [result, resumeScanning]);

  const handleDetect = useCallback(async (ticketCode: string) => {
    if (processingRef.current) {
      return;
    }

    processingRef.current = true;
    setPaused(true);
    setLoading(true);
    setResult(null);

    try {
      const apiResult = await postScanTicket(ticketCode);
      setResult(apiResult);

      if (apiResult.status === "VALID") {
        playSuccessBeep();
        vibrateSuccess();
      } else {
        playErrorBeep();
        vibrateError();
      }
    } catch {
      playErrorBeep();
      vibrateError();
      setResult({ status: "NOT_FOUND" });
    } finally {
      setLoading(false);
    }
  }, []);

  function handleRetryCamera() {
    setCameraError(null);
    processingRef.current = false;
    setPaused(false);
    setLoading(false);
    setResult(null);
    setScannerKey((current) => current + 1);
  }

  if (cameraError) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-6 text-center text-white">
        <p className="max-w-md text-2xl leading-relaxed font-semibold sm:text-3xl">
          {cameraError}
        </p>
        <button
          type="button"
          onClick={handleRetryCamera}
          className="mt-10 rounded-2xl bg-white px-8 py-5 text-xl font-bold text-black"
        >
          Spróbuj ponownie
        </button>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-50 overflow-hidden bg-black">
      <QRScanner
        key={scannerKey}
        paused={paused || loading}
        onDetect={handleDetect}
        onCameraError={setCameraError}
      />
      <ScanOverlay />
      <ScanResult loading={loading} result={result} />
    </main>
  );
}
