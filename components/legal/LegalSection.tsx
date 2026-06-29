import { ContactCard } from "@/components/legal/ContactCard";

type LegalSectionProps = {
  title: string;
  children: React.ReactNode;
};

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <ContactCard title={title}>
      {children}
    </ContactCard>
  );
}
