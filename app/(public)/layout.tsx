export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-8 border-b border-border pb-4">
        <p className="text-sm text-muted">Rezerwacja biletow online</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Ogrod Bellingham
        </h1>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-10 border-t border-border pt-4 text-sm text-muted">
        <p>Godziny otwarcia i informacje organizacyjne pojawia sie tutaj.</p>
      </footer>
    </div>
  );
}
