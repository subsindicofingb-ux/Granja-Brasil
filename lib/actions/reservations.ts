"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCondoAccess, requireCondoPermission } from "@/lib/auth/access";
import type { AuthActionState } from "@/lib/auth/types";
import {
  approveReservation,
  cancelReservation,
  createReservation,
  listUnitIdsForProfile,
  rejectReservation,
} from "@/lib/services/reservations";
import { parseReservationFormData } from "@/lib/validations/reservation.schema";

function revalidateReservationPaths(condoSlug: string, reservationId?: string) {
  revalidatePath(`/app/${condoSlug}/reservations`);
  if (reservationId) {
    revalidatePath(`/app/${condoSlug}/reservations/${reservationId}`);
  }
}

async function assertCanBookForUnit(
  condoSlug: string,
  unitId: string,
  isStaff: boolean,
  profileId: string,
  condominiumId: string,
): Promise<AuthActionState | null> {
  if (isStaff) {
    return null;
  }

  const unitsResult = await listUnitIdsForProfile(profileId, condominiumId);

  if (!unitsResult.ok) {
    return { error: unitsResult.error };
  }

  if (!unitsResult.data.includes(unitId)) {
    return { error: "Você só pode reservar para suas unidades." };
  }

  return null;
}

export async function createReservationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const access = await requireCondoAccess(condoSlug);

  if (!access.permissions.canManageReservations) {
    return { error: "Sem permissão para criar reservas." };
  }

  const parsed = parseReservationFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const isStaff = access.permissions.canApproveReservations;

  const unitCheck = await assertCanBookForUnit(
    condoSlug,
    parsed.data.unit_id,
    isStaff,
    access.profile.id,
    access.condominium.id,
  );

  if (unitCheck?.error) {
    return unitCheck;
  }

  const result = await createReservation({
    condominiumId: access.condominium.id,
    commonAreaId: parsed.data.common_area_id,
    unitId: parsed.data.unit_id,
    startAt: parsed.data.start_at,
    endAt: parsed.data.end_at,
    notes: parsed.data.notes,
    requestedBy: access.profile.id,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateReservationPaths(condoSlug, result.data.id);
  redirect(`/app/${condoSlug}/reservations/${result.data.id}`);
}

export async function approveReservationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const reservationId = String(formData.get("reservation_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canApproveReservations,
    { redirectTo: `/app/${condoSlug}/reservations/${reservationId}` },
  );

  const result = await approveReservation(reservationId, access.condominium.id);

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateReservationPaths(condoSlug, reservationId);
  return { success: "Reserva aprovada com sucesso." };
}

export async function rejectReservationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const reservationId = String(formData.get("reservation_id") ?? "");

  const access = await requireCondoPermission(
    condoSlug,
    (ctx) => ctx.permissions.canApproveReservations,
    { redirectTo: `/app/${condoSlug}/reservations/${reservationId}` },
  );

  const result = await rejectReservation(reservationId, access.condominium.id);

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateReservationPaths(condoSlug, reservationId);
  return { success: "Reserva rejeitada." };
}

export async function cancelReservationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const condoSlug = String(formData.get("condo_slug") ?? "");
  const reservationId = String(formData.get("reservation_id") ?? "");

  const access = await requireCondoAccess(condoSlug);
  const isStaff = access.permissions.canApproveReservations;

  if (!isStaff && !access.permissions.canManageReservations) {
    redirect(`/app/${condoSlug}/reservations/${reservationId}`);
  }

  if (!isStaff) {
    const { getReservationById } = await import("@/lib/services/reservations");
    const current = await getReservationById(reservationId, access.condominium.id);

    if (!current.ok) {
      return { error: current.error };
    }

    const unitsResult = await listUnitIdsForProfile(
      access.profile.id,
      access.condominium.id,
    );

    if (!unitsResult.ok) {
      return { error: unitsResult.error };
    }

    if (!unitsResult.data.includes(current.data.unit_id)) {
      return { error: "Você só pode cancelar reservas das suas unidades." };
    }
  }

  const result = await cancelReservation(reservationId, access.condominium.id);

  if (!result.ok) {
    return { error: result.error };
  }

  revalidateReservationPaths(condoSlug, reservationId);
  return { success: "Reserva cancelada." };
}
