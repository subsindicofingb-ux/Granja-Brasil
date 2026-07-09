import type { CommonAreaRecord } from "@/lib/common-areas/types";
import { getGranjaCondominiumId } from "@/lib/condominiums/granja-shared-areas";
import {
  requiresPaymentReceipt,
  requiresGuestCount,
} from "@/lib/reservations/area-rules";
import { isSlotBasedArea } from "@/lib/reservations/slot-booking";
import type { ReservationAreaOption } from "@/components/reservations/reservation-form";

export async function buildReservationAreaOptions(
  areas: CommonAreaRecord[],
): Promise<ReservationAreaOption[]> {
  const granjaCondominiumId = await getGranjaCondominiumId();

  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    requiresApproval: area.requires_approval,
    requiresGuestCount: requiresGuestCount(area.name),
    requiresPaymentReceipt: requiresPaymentReceipt({
      requires_payment: area.requires_payment,
      name: area.name,
      areaCondominiumId: area.condominium_id,
      granjaCondominiumId,
    }),
    capacity: area.capacity,
    operatingHours: area.operating_hours,
    usesSlotBooking: isSlotBasedArea(area),
    maxDurationMinutes: area.max_duration_minutes,
    slotIntervalMinutes: area.slot_interval_minutes,
    rules: area.description,
  }));
}
