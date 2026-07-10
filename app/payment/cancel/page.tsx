import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment cancelled | Ogród Bellingham",
  description: "Your payment was cancelled.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PaymentCancelPage() {
  return (
    <main className="bg-white px-6 py-10 text-[#1f4d35] sm:px-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <section className="garden-section p-8 text-center sm:p-10">
          <h1 className="text-2xl font-semibold">Payment was cancelled.</h1>

          <p className="mt-4 text-sm leading-6 text-[#666]">
            You can safely return and try again.
          </p>

          <div className="mt-8">
            <Link href="/" className="garden-btn inline-flex px-5 py-3 text-sm font-medium">
              Buy tickets again
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
