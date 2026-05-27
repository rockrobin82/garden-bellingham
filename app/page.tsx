export default function HomePage() {
    return (
      <main className="min-h-screen bg-[#071b11] text-white p-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-zinc-400 mb-2">
            Rezerwacja biletow online
          </p>
  
          <h1 className="text-6xl font-bold mb-8">
            Ogrod Bellingham
          </h1>
  
          <div className="border border-green-900 rounded-3xl p-10 bg-[#0b2216]">
            <p className="text-green-400 mb-4">
              MVP w przygotowaniu
            </p>
  
            <h2 className="text-4xl font-semibold mb-6">
              System rezerwacji biletow do Ogrodu Bellingham
            </h2>
  
            <p className="text-zinc-300 text-xl leading-relaxed">
              To jest strona startowa MVP.
            </p>
          </div>
        </div>
      </main>
    );
  }