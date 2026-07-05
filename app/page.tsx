import type { ReactNode } from "react";
import { AvailabilityCalendar } from "@/components/booking/AvailabilityCalendar";

function IconBadge({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-[#f6faf7] text-[#1f4d35]">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        {children}
      </svg>
    </span>
  );
}

function LeafIcon() {
  return (
    <IconBadge>
      <path d="M5 19c8 0 14-6 14-14C11 5 5 11 5 19Z" />
      <path d="M5 19c3-5 7-8 14-14" />
    </IconBadge>
  );
}

function CalendarIcon() {
  return (
    <IconBadge>
      <path d="M7 3v3" />
      <path d="M17 3v3" />
      <path d="M4 8h16" />
      <rect x="4" y="5" width="16" height="16" rx="2" />
    </IconBadge>
  );
}

function ClockIcon() {
  return (
    <IconBadge>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </IconBadge>
  );
}

function FootstepsIcon() {
  return (
    <IconBadge>
      <path d="M6.5 14.5c-1.5 1-2 2.4-1.2 3.5.8 1.2 2.6 1.1 4.1-.1 1.4-1.1 1.8-2.8.9-3.8-.8-1-2.3-.7-3.8.4Z" />
      <path d="M14.7 6.1c-1.4 1-1.9 2.6-1.1 3.6.8 1.1 2.5.9 3.9-.2 1.3-1.1 1.7-2.7.9-3.7-.8-.9-2.3-.7-3.7.3Z" />
    </IconBadge>
  );
}

function UserIcon() {
  return (
    <IconBadge>
      <circle cx="12" cy="7" r="3" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </IconBadge>
  );
}

function BookIcon() {
  return (
    <IconBadge>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M8 7h8" />
    </IconBadge>
  );
}

function SproutIcon() {
  return (
    <IconBadge>
      <path d="M12 20v-8" />
      <path d="M12 12c-5 0-7-3-7-7 5 0 7 3 7 7Z" />
      <path d="M12 12c5 0 7-3 7-7-5 0-7 3-7 7Z" />
      <path d="M7 20h10" />
    </IconBadge>
  );
}

function CoffeeIcon() {
  return (
    <IconBadge>
      <path d="M6 8h10v5a5 5 0 0 1-10 0V8Z" />
      <path d="M16 9h1a3 3 0 0 1 0 6h-1" />
      <path d="M8 3v2" />
      <path d="M12 3v2" />
      <path d="M5 21h12" />
    </IconBadge>
  );
}

function CarIcon() {
  return (
    <IconBadge>
      <path d="m5 12 2-5h10l2 5" />
      <path d="M5 12h14v5H5z" />
      <circle cx="8" cy="17" r="1.5" />
      <circle cx="16" cy="17" r="1.5" />
    </IconBadge>
  );
}

function ToiletIcon() {
  return (
    <IconBadge>
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
      <path d="M7 20h10" />
      <path d="M12 14v6" />
    </IconBadge>
  );
}

function AlertIcon() {
  return (
    <IconBadge>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </IconBadge>
  );
}

function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-border py-4 last:border-b-0">
      {icon}
      <div className="min-w-0 text-sm leading-6 text-[#666]">{children}</div>
    </div>
  );
}

function FeatureCard({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      {icon}
      <p className="mt-4 text-sm font-semibold text-[#1f4d35]">{title}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-10 text-[#1f4d35] sm:px-10 sm:py-14">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="py-4 sm:py-8">
          <div className="flex items-center gap-5 sm:gap-8">
            <div className="flex shrink-0 items-center justify-center">
              <img
                src="/logo.png"
                alt="Logo Ogród Bellingham"
                className="h-[52px] w-[52px] sm:h-[110px] sm:w-[110px]"
              />
            </div>

            <div className="flex flex-col justify-center">
              <p className="mb-2 text-sm text-[#666] sm:text-base">
                Kup wejściówkę do ogrodu
              </p>
              <h1 className="text-4xl font-bold leading-tight text-[#1f4d35] sm:text-6xl">
                Ogród Bellingham
              </h1>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="garden-section flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <LeafIcon />
              <div>
                <h2 className="text-3xl font-semibold leading-tight text-[#1f4d35] sm:text-4xl">
                  Wyjątkowy Piątek
                </h2>
                <p className="mt-2 text-base font-medium leading-6 text-[#1f4d35]">
                  Zwiedzanie z Katarzyną Bellingham
                  <br />
                  lub Jackiem Naliwajkiem
                </p>
              </div>
            </div>

            <div className="mt-8">
              <InfoRow icon={<CalendarIcon />}>
                <p className="font-semibold text-[#1f4d35]">Co drugi piątek miesiąca</p>
              </InfoRow>
              <InfoRow icon={<ClockIcon />}>
                <p className="font-semibold text-[#1f4d35]">11:00–15:00</p>
              </InfoRow>
              <InfoRow icon={<FootstepsIcon />}>
                <p className="font-semibold text-[#1f4d35]">12:00–14:00</p>
                <p>Oprowadzanie po ogrodzie połączone z czasem na pytania.</p>
              </InfoRow>
              <InfoRow icon={<UserIcon />}>
                <p className="font-semibold text-[#1f4d35]">
                  Spotkanie z Katarzyną Bellingham lub Jackiem Naliwajkiem
                </p>
              </InfoRow>
              <InfoRow icon={<BookIcon />}>
                <p className="font-semibold text-[#1f4d35]">Możliwość podpisania książek</p>
              </InfoRow>
            </div>

            <div className="mt-auto pt-6">
              <div className="rounded-2xl border border-border bg-white p-5">
                <div className="flex items-center gap-3">
                  <AlertIcon />
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#1f4d35]">
                    Ważna informacja
                  </p>
                </div>
                <div className="mt-4 space-y-2 text-sm leading-6 text-[#666]">
                  <p>Piątkowe spotkania mają kameralny charakter.</p>
                  <p>Liczba miejsc jest ściśle ograniczona.</p>
                  <p className="font-semibold text-[#1f4d35]">
                    Kup bilet wcześniej, aby mieć gwarancję udziału.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="garden-section flex h-full flex-col p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <SproutIcon />
              <h2 className="text-3xl font-semibold leading-tight text-[#1f4d35] sm:text-4xl">
                Weekendowe zwiedzanie
              </h2>
            </div>

            <div className="mt-8">
              <InfoRow icon={<CalendarIcon />}>
                <p className="font-semibold text-[#1f4d35]">Sobota i niedziela</p>
              </InfoRow>
              <InfoRow icon={<ClockIcon />}>
                <p className="font-semibold text-[#1f4d35]">11:00–16:00</p>
              </InfoRow>
              <InfoRow icon={<LeafIcon />}>
                <p>
                  Do Państwa dyspozycji udostępniamy{" "}
                  <span className="font-semibold text-[#1f4d35]">
                    ogród dolny oraz ogród górny.
                  </span>
                </p>
              </InfoRow>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <FeatureCard icon={<SproutIcon />} title="Szkółka roślin" />
              <FeatureCard icon={<CoffeeIcon />} title="Kawiarenka" />
              <FeatureCard icon={<CarIcon />} title="Darmowy parking" />
              <FeatureCard icon={<ToiletIcon />} title="Toalety" />
            </div>

            <div className="mt-auto pt-6">
              <div className="rounded-2xl border border-border bg-white p-5">
                <div className="flex items-center gap-3">
                  <AlertIcon />
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#1f4d35]">
                    Informacja praktyczna
                  </p>
                </div>
                <div className="mt-4 space-y-2 text-sm leading-6 text-[#666]">
                  <p>Na weekendowe zwiedzanie obowiązują bilety wstępu.</p>
                  <p>
                    Ze względu na ograniczoną liczbę odwiedzających zalecamy
                    wcześniejszą rezerwację online.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <AvailabilityCalendar />
      </div>
    </main>
  );
}
