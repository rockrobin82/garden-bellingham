import { ContactCard } from "@/components/legal/ContactCard";

type LegalSectionProps = {
  title: string;
  placeholder: string;
};

export function LegalSection({ title, placeholder }: LegalSectionProps) {
  return (
    <ContactCard title={title}>
      <p className="mt-3 text-sm leading-6 text-[#666]">{placeholder}</p>
    </ContactCard>
  );
}
