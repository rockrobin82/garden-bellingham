export function ScanOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="flex h-full w-full items-center justify-center p-6">
        <div
          className="relative h-64 w-64 max-w-[min(80vw,80vh)] rounded-3xl border-4 border-white/90 sm:h-72 sm:w-72"
          style={{
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.62)",
          }}
        >
          <div className="absolute -top-1 -left-1 h-10 w-10 border-t-4 border-l-4 border-white" />
          <div className="absolute -top-1 -right-1 h-10 w-10 border-t-4 border-r-4 border-white" />
          <div className="absolute -bottom-1 -left-1 h-10 w-10 border-b-4 border-l-4 border-white" />
          <div className="absolute -right-1 -bottom-1 h-10 w-10 border-r-4 border-b-4 border-white" />
        </div>
      </div>

      <div className="absolute top-6 right-0 left-0 px-6 text-center">
        <p className="text-lg font-semibold text-white drop-shadow-lg sm:text-xl">
          Skanuj kod QR biletu
        </p>
      </div>
    </div>
  );
}
