type ContactCardProps = {
  title: string;
  children: React.ReactNode;
};

export function ContactCard({ title, children }: ContactCardProps) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <h2 className="text-xl font-semibold text-[#1f4d35]">{title}</h2>
      {children}
    </section>
  );
}
