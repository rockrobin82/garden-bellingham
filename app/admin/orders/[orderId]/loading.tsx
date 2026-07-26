import { AdminLoadingState } from "@/components/admin/AdminTableStates";

export default function AdminOrderLoading() {
  return (
    <AdminLoadingState
      title="Ładowanie zamówienia…"
      description="Pobieramy szczegóły zamówienia i bilety."
    />
  );
}
