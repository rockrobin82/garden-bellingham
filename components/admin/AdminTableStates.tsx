type AdminStateProps = {
  title: string;
  description: string;
};

export function AdminLoadingState({
  title = "Ładowanie…",
  description = "Pobieramy dane zamówień.",
}: Partial<AdminStateProps>) {
  return (
    <div className="garden-section p-6 sm:p-8">
      <p className="text-sm font-medium uppercase tracking-wide text-[#666]">
        Admin
      </p>
      <h2 className="mt-2 text-xl font-semibold text-[#1f4d35]">{title}</h2>
      <p className="mt-2 text-sm text-[#666]">{description}</p>
    </div>
  );
}

export function AdminEmptyState({
  title = "Brak zamówień",
  description = "Nie znaleziono żadnych zamówień do wyświetlenia.",
}: Partial<AdminStateProps>) {
  return (
    <div className="garden-section p-6 text-sm text-[#666] sm:p-8">
      <h2 className="text-lg font-semibold text-[#1f4d35]">{title}</h2>
      <p className="mt-2">{description}</p>
    </div>
  );
}

export function AdminErrorState({
  title = "Nie udało się wczytać danych",
  description = "Spróbuj odświeżyć stronę za chwilę.",
}: Partial<AdminStateProps>) {
  return (
    <div className="garden-section p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-red-700">{title}</h2>
      <p className="mt-2 text-sm text-red-600">{description}</p>
    </div>
  );
}
