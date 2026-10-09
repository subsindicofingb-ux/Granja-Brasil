"use server";

import { requireCondoAccess } from "@/lib/auth/access";
import { getBookableCommonAreaById } from "@/lib/services/common-areas";
import { listBlockingReservationsForArea } from "@/lib/services/reservations";
import { isClassArea } from "@/lib/reservations/class-booking";
import {
  buildAvailableTimeSlots,
  getClassDurationOptions,
  getDurationOptions,
  isSlotBasedArea,
  type AvailableTimeSlot,
} from "@/lib/reservations/slot-booking";

export type ReservationTimeSlotsResult =
  | {
      ok: true;
      durationOptions: number[];
      slotsByDuration: Record<number, AvailableTimeSlot[]>;
    }
  | { ok: false; error: string };

export async function getReservationTimeSlotsAction(
  condoSlug: string,
  areaId: string,
  dateKey: string,
  excludeReservationId?: string,
): Promise<ReservationTimeSlotsResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { ok: false, error: "Data inválida." };
  }

  try {
    const access = await requireCondoAccess(condoSlug);

    if (!access.permissions.canManageReservations) {
      return { ok: false, error: "Sem permissão." };
    }

    const areaResult = await getBookableCommonAreaById(areaId, {
      condominiumId: access.condominium.id,
      condominiumSlug: access.condominium.slug,
    });

    if (!areaResult.ok || !areaResult.data) {
      return { ok: false, error: areaResult.ok ? "Espaço não encontrado." : areaResult.error };
    }

    if (!isSlotBasedArea(areaResult.data)) {
      return { ok: false, error: "Este espaço não usa reserva por turno." };
    }

    const reservationsResult = await listBlockingReservationsForArea(areaId);

    if (!reservationsResult.ok) {
      return { ok: false, error: reservationsResult.error };
    }

    const durationOptions = isClassArea(areaResult.data)
      ? getClassDurationOptions(areaResult.data, dateKey)
      : getDurationOptions(areaResult.data);
    const slotsByDuration: Record<number, AvailableTimeSlot[]> = {};

    for (const duration of durationOptions) {
      slotsByDuration[duration] = buildAvailableTimeSlots({
        area: areaResult.data,
        dateKey,
        reservations: reservationsResult.data,
        durationMinutes: duration,
        excludeReservationId,
      });
    }

    return {
      ok: true,
      durationOptions,
      slotsByDuration,
    };
  } catch {
    return { ok: false, error: "Não foi possível carregar os horários disponíveis." };
  }
}
