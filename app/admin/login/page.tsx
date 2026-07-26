import { LoginForm } from "@/components/admin/LoginForm";

export default function AdminLoginPage() {
  return (
    <section className="mx-auto max-w-md garden-section p-6 sm:p-8">
      <p className="text-sm font-medium uppercase tracking-wide text-[#666]">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Logowanie</h1>
      <p className="mt-2 text-sm text-[#666]">
        Wprowadź hasło administratora, aby zobaczyć zamówienia.
      </p>
      <LoginForm />
    </section>
  );
}
