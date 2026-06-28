type LegalSectionProps = {
  title: string;
  placeholder: string;
};

export function LegalSection({ title, placeholder }: LegalSectionProps) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <h2 className="text-xl font-semibold text-[#1f4d35]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#666]">{placeholder}</p>
    </section>
  );
}
