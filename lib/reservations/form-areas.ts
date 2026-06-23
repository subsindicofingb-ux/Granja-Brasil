import type { CommonAreaRecord } from "@/lib/common-areas/types";
import { getGranjaCondominiumId } from "@/lib/condominiums/granja-shared-areas";
import {
  requiresGranjaPaymentReceipt,
  requiresGuestCount,
} from "@/lib/reservations/area-rules";
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
    requiresPaymentReceipt: requiresGranjaPaymentReceipt({
      areaName: area.name,
      areaCondominiumId: area.condominium_id,
      granjaCondominiumId,
    }),
    capacity: area.capacity,
    operatingHours: area.operating_hours,
    rules: area.description,
  }));
}
