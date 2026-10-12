import type { AvailabilityEntrySlot } from "@/lib/availability/entry-slots";

export function isTestEntrySlot(slot: Pick<AvailabilityEntrySlot, "note">): boolean {
  return slot.note.trim() === "TEST";
}

export function isOfferEntrySlot(slot: AvailabilityEntrySlot): boolean {
  return !isTestEntrySlot(slot);
}

export function canSelectEntrySlot(slot: AvailabilityEntrySlot): boolean {
  return isOfferEntrySlot(slot) && slot.active && slot.remaining > 0;
}

export function offerEntrySlots(
  slots: readonly AvailabilityEntrySlot[],
): AvailabilityEntrySlot[] {
  return slots
    .filter(isOfferEntrySlot)
    .slice()
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.timeStart.localeCompare(right.timeStart) ||
        left.slotId.localeCompare(right.slotId),
    );
}
