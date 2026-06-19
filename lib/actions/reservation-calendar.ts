"use server";

import { requireCondoAccess } from "@/lib/auth/access";
import { getBookableCommonAreaById } from "@/lib/services/common-areas";
import { listBlockingReservationsForArea } from "@/lib/services/reservations";
import {
  buildReservationCalendarDays,
  type ReservationCalendarDay,
} from "@/lib/reservations/calendar-availability";

export type ReservationCalendarResult =
  | { ok: true; days: ReservationCalendarDay[] }
  | { ok: false; error: string };

export async function getReservationCalendarAction(
  condoSlug: string,
  areaId: string,
  month: string,
): Promise<ReservationCalendarResult> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { ok: false, error: "Mês inválido." };
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

    const reservationsResult = await listBlockingReservationsForArea(areaId);

    if (!reservationsResult.ok) {
      return { ok: false, error: reservationsResult.error };
    }

    return {
      ok: true,
      days: buildReservationCalendarDays({
        area: areaResult.data,
        reservations: reservationsResult.data,
        month,
      }),
    };
  } catch {
    return { ok: false, error: "Não foi possível carregar o calendário." };
  }
}
