import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment successful | Ogród Bellingham",
  description: "Your payment was successful.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PaymentSuccessPage() {
  return (
    <main className="bg-white px-6 py-10 text-[#1f4d35] sm:px-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <section className="garden-section p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#d7e8dc] bg-white text-3xl">
            ✓
          </div>

          <h1 className="mt-6 text-2xl font-semibold">Payment successful</h1>

          <p className="mt-4 text-sm leading-6 text-[#666]">
            Thank you for your purchase.
          </p>

          <p className="mt-3 text-sm leading-6 text-[#666]">
            Your tickets are being prepared and will be sent to your email shortly.
          </p>

          <div className="mt-8">
            <Link href="/" className="garden-btn inline-flex px-5 py-3 text-sm font-medium">
              Back to home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
